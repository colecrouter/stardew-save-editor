using System.Globalization;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace AssetDump;

internal sealed partial class CatalogGenerator
{
    internal static string CookingOutput(string name, string definition)
    {
        // Quantity is optional and defaults to one; progress stores only the ID.
        var output = definition.Split('/').ElementAtOrDefault(2)?.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        if (output == null || output.Length is < 1 or > 2)
            throw new InvalidDataException($"Unsupported cooking output for {name}");
        return Regex.Replace(output[0], @"^\(O\)", "");
    }

    internal static JObject? ParseQuest(string id, string raw)
    {
        // The game ignores entries missing required fields or a valid reward.
        // Keep optional fields absent, and preserve host-only 'h' next-quest IDs.
        var fields = raw.Split('/');
        string? Optional(int i) => string.IsNullOrWhiteSpace(fields.ElementAtOrDefault(i)) ? null : fields[i];
        string[] Parts(int i) => (Optional(i) ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        string? cancel = Optional(8)?.ToLowerInvariant();
        if (Optional(0) == null || Optional(1) == null || Optional(2) == null
            || !Regex.IsMatch((Optional(6) ?? "").Trim(), @"^-?\d+$") || cancel is not (null or "true" or "false")) return null;
        double money = double.Parse(fields[6], CultureInfo.InvariantCulture);
        return Object(("id", id), ("type", fields[0]), ("title", fields[1]), ("description", fields[2]),
            ("objective", Optional(3)), ("conditions", Parts(4).Length == 0 ? null : Parts(4)),
            ("nextQuests", Parts(5)), ("moneyReward", money), ("rewardDescription", money == -1 ? null : Optional(7)),
            ("canBeCancelled", cancel == "true"));
    }

    internal static Func<string, string> ObjectiveResolver(string quest, JArray? elements, JObject strings)
    {
        var substitutions = new Dictionary<string, string>();
        foreach (var element in elements ?? [])
        {
            var values = (JArray)element["Values"]!;
            if (values.Count != 1 || Truth(values[0]["RequiredTags"]))
                throw new InvalidDataException($"{quest}: {Text(element["Name"])} requires runtime selection");
            var fields = Text(values[0]["Value"]).Split('|');
            for (int i = 0; i < fields.Length; i += 2)
            {
                if (fields[i] == "" || i + 1 == fields.Length)
                    throw new InvalidDataException($"{quest}: invalid {Text(element["Name"])} substitution");
                substitutions[$"{Text(element["Name"])}:{fields[i]}"] = fields[i + 1];
            }
        }
        // Resolve nested string/element tokens, rejecting cycles rather than
        // silently publishing text the editor cannot interpret.
        string Resolve(string text, int depth)
        {
            if (depth > 10) throw new InvalidDataException($"{quest}: cyclic objective tokens");
            return Regex.Replace(text, @"\[([^\[\]]+)\]|\{([^{}]+)\}", match =>
            {
                string? value = match.Groups[1].Success ? strings[match.Groups[1].Value]?.ToString() : substitutions.GetValueOrDefault(match.Groups[2].Value);
                return value == null ? throw new InvalidDataException($"{quest}: unresolved objective token {match.Value}") : Resolve(value, depth + 1);
            });
        }
        return text => Resolve(text, 0);
    }

    internal static double RequiredCount(string text)
    {
        if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out double count)
            || count <= 0 || count != Math.Truncate(count) || count > 9007199254740991)
            throw new InvalidDataException($"Invalid special-order objective count: {text}");
        return count;
    }

    private static IEnumerable<JObject> SpecialOrders(JObject orders, JObject strings)
    {
        var days = new Dictionary<string, int> { ["OneDay"] = 1, ["ThreeDays"] = 3, ["Week"] = 7, ["TwoWeeks"] = 14, ["Month"] = 28 };
        string Token(JToken? token)
        {
            string text = Text(token);
            var match = Regex.Match(text, @"^\[(.+)\]$");
            return match.Success ? Text(strings[match.Groups[1].Value], text) : text;
        }
        return Entries(orders).Where(p => Text(p.Value!["OrderType"]) == "Qi").Select(p =>
        {
            var order = p.Value!;
            var resolve = ObjectiveResolver(p.Key, order["RandomizedElements"] as JArray, strings);
            var objectives = ((JArray)order["Objectives"]!).Select(o =>
            {
                var data = o["Data"] as JObject;
                return Object(("type", o["Type"]), ("description", resolve(Text(o["Text"]))),
                    ("maxCount", RequiredCount(resolve(Text(o["RequiredCount"])))),
                    ("acceptableContextTagSets", resolve(Text(data?["AcceptedContextTags"]))), ("dropBox", data?["DropBox"]),
                    ("dropBoxGameLocation", data?["DropBoxGameLocation"]), ("dropBoxTileLocation", data?["DropBoxIndicatorLocation"]),
                    ("minimumCapacity", Truth(data?["MinimumCapacity"]) ? double.Parse(Text(data!["MinimumCapacity"]), CultureInfo.InvariantCulture) : null),
                    ("useShipmentValue", Text(o["Type"]) == "Ship" ? Text(data?["UseShipmentValue"]) == "True" : null),
                    ("skullCave", Text(o["Type"]) == "ReachMineFloor" ? Text(data?["SkullCave"]).ToLowerInvariant() == "true" : null));
            });
            var gems = ((JArray)order["Rewards"]!).FirstOrDefault(r => Text(r["Type"]) == "Gems")?["Data"]?["Amount"];
            // Saves keep raw tokens so the game can localize them again; UI text
            // and duration-day counts are separate editor-facing conveniences.
            return Object(("questKey", p.Key), ("name", Token(order["Name"])), ("description", Token(order["Text"])),
                ("nameToken", order["Name"]), ("descriptionToken", order["Text"]), ("duration", order["Duration"]),
                ("durationDays", days.GetValueOrDefault(Text(order["Duration"]), 7)), ("specialRule", Text(order["SpecialRule"])),
                ("objectives", objectives), ("rewardGems", double.Parse(Text(gems, "0"), CultureInfo.InvariantCulture)));
        });
    }
}
