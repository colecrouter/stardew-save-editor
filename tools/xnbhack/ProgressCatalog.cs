using Newtonsoft.Json.Linq;

namespace AssetDump;

/// <summary>Keep completion membership separate from the much larger item catalog.</summary>
internal static class ProgressCatalog
{
    internal static JObject AchievementRequirements(JObject objects, JObject crops)
    {
        // LibraryMuseum.totalArtifacts counts object types eligible for donation.
        // Explicit context tags override the ordinary artifact/mineral type rule.
        bool Donates(JProperty entry)
        {
            // JSON null is a JValue, not a missing property or a tag sequence.
            var tags = entry.Value["ContextTags"] is JArray rawTags ? rawTags.Values<string>().ToHashSet() : [];
            return !tags.Contains("not_museum_donatable") &&
                (tags.Contains("museum_donatable") || (string?)entry.Value["Type"] is "Arch" or "Minerals");
        }
        // Stats.checkForShippingAchievements uses crop-data flags, not all items
        // in the shipping collection. Duplicate harvest IDs remain one requirement.
        JArray Harvests(string flag) => new(crops.Properties()
            .Where(entry => entry.Value[flag]?.Value<bool>() == true)
            .Select(entry => entry.Value["HarvestItemId"]!.Value<string>()).Distinct());
        return new JObject
        {
            ["museumCount"] = objects.Properties().Count(Donates),
            ["polyculture"] = Harvests("CountForPolyculture"),
            ["monoculture"] = Harvests("CountForMonoculture")
        };
    }

    internal static JObject Build(JObject objects, JObject characters, JObject monsters, JObject achievements)
    {
        // Utility.getFarmerItemsShippedPercent delegates to Object.isPotentialBasicShipped.
        // A special item bypasses ordinary type/category exclusions in that method.
        int[] excludedCategories = [-999, -103, -102, -96, -74, -29, -24, -22, -21, -20, -19, -14, -12, -8, -7, -2, 0];
        string[] excludedTypes = ["Arch", "Fish", "Minerals", "Cooking"];
        bool Ships(JProperty entry)
        {
            var data = entry.Value;
            return entry.Name == "433" ||
                (!excludedTypes.Contains((string?)data["Type"]) &&
                 !excludedCategories.Contains((int?)data["Category"] ?? 0) &&
                 data["ExcludeFromShippingCollection"]?.Value<bool>() != true);
        }
        JObject Item(JProperty entry) => new() { ["id"] = entry.Name, ["name"] = entry.Value["Name"]?.DeepClone() ?? entry.Name };
        return new JObject
        {
            ["shipping"] = new JArray(objects.Properties().Where(Ships).Select(Item)),
            // Utility.getFishCaughtPercent includes algae/jellies when the object
            // data marks them Fish and does not exclude them from the collection.
            ["fish"] = new JArray(objects.Properties().Where(entry =>
                (string?)entry.Value["Type"] == "Fish" && entry.Value["ExcludeFromFishingCollection"]?.Value<bool>() != true).Select(Item)),
            ["friends"] = new JArray(characters.Properties().Where(entry =>
                entry.Value["PerfectionScore"]?.Value<bool>() == true &&
                !string.Equals((string?)entry.Value["CanSocialize"], "FALSE", StringComparison.OrdinalIgnoreCase))
                .Select(entry => new JObject { ["name"] = entry.Name, ["points"] = entry.Value["CanBeRomanced"]?.Value<bool>() == true ? 2000 : 2500 })),
            ["monsters"] = new JArray(monsters.Properties().Select(entry => new JObject
            {
                ["name"] = entry.Name, ["targets"] = entry.Value["Targets"]?.DeepClone() ?? new JArray(),
                ["count"] = entry.Value["Count"]?.DeepClone() ?? 0
            })),
            // Retain game IDs and descriptions so recorded awards can be shown
            // even before a diagnostic for their underlying requirement exists.
            ["achievements"] = new JArray(achievements.Properties().Select(entry =>
            {
                string[] fields = entry.Value.Value<string>()!.Split('^');
                return new JObject { ["id"] = int.Parse(entry.Name), ["name"] = fields[0].Split(" (")[0], ["description"] = fields[1] };
            }))
        };
    }
}
