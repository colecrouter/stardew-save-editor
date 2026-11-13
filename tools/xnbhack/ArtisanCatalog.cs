using Newtonsoft.Json.Linq;

namespace AssetDump;

internal sealed partial class CatalogGenerator
{
    // TailoringMenu's context-tag colors are retained as CSS RGB strings because
    // the editor renders flavored artisan goods using these exact values.
    private static readonly Dictionary<string, string> Colors = new()
    {
        ["color_gray"] = "rgb(45, 45, 45)",
        ["color_white"] = "rgb(255, 255, 255)",
        ["color_pink"] = "rgb(255, 163, 186)",
        ["color_red"] = "rgb(220, 0, 0)",
        ["color_orange"] = "rgb(255, 128, 0)",
        ["color_yellow"] = "rgb(255, 230, 0)",
        ["color_green"] = "rgb(10, 143, 0)",
        ["color_blue"] = "rgb(46, 85, 183)",
        ["color_purple"] = "rgb(115, 41, 181)",
        ["color_brown"] = "rgb(130, 73, 37)",
        ["color_light_cyan"] = "rgb(180, 255, 255)",
        ["color_cyan"] = "rgb(0, 255, 255)",
        ["color_aquamarine"] = "rgb(127, 255, 212)",
        ["color_sea_green"] = "rgb(46, 139, 87)",
        ["color_lime"] = "rgb(0, 255, 0)",
        ["color_yellow_green"] = "rgb(173, 255, 47)",
        ["color_pale_violet_red"] = "rgb(219, 112, 147)",
        ["color_salmon"] = "rgb(255, 85, 95)",
        ["color_jade"] = "rgb(130, 158, 93)",
        ["color_sand"] = "rgb(255, 222, 173)",
        ["color_poppyseed"] = "rgb(82, 47, 153)",
        ["color_dark_red"] = "rgb(139, 0, 0)",
        ["color_dark_orange"] = "rgb(255, 140, 0)",
        ["color_dark_yellow"] = "rgb(184, 134, 11)",
        ["color_dark_green"] = "rgb(0, 100, 0)",
        ["color_dark_blue"] = "rgb(0, 0, 139)",
        ["color_dark_purple"] = "rgb(148, 0, 211)",
        ["color_dark_pink"] = "rgb(255, 20, 147)",
        ["color_dark_cyan"] = "rgb(0, 139, 139)",
        ["color_dark_gray"] = "rgb(169, 169, 169)",
        ["color_dark_brown"] = "rgb(139, 69, 19)",
        ["color_gold"] = "rgb(255, 215, 0)",
        ["color_copper"] = "rgb(184, 134, 11)",
        ["color_iron"] = "rgb(197, 213, 224)",
        ["color_iridium"] = "rgb(105, 15, 255)",
    };

    private static IEnumerable<JObject> ArtisanGoods(List<JObject> sources, List<JObject> objects)
    {
        // Each variant starts with its ingredient's fields but uses the product's
        // identity and description. This mirrors the game's preserved-item model.
        IEnumerable<JObject> Make(string productKey, Func<JObject, bool> accepts, string label,
            bool prefix, double edible, Func<double, double> price, bool tinted = false, bool keepTexture = false)
        {
            var product = objects.First(o => Text(o["_key"]) == productKey || Text(o["name"]) == productKey);
            foreach (var source in sources.Where(accepts))
            {
                var item = (JObject)source.DeepClone();
                item["_key"] = product["_key"]!.DeepClone();
                item["name"] = prefix ? $"{label} {Text(source["name"])}" : $"{Text(source["name"])} {label}";
                if (product["description"] is { } description) item["description"] = description.DeepClone();
                else item.Remove("description");
                item["edibility"] = Math.Max(0, Math.Floor(Number(source["edibility"]) * edible));
                item["price"] = price(Number(source["price"]));
                item["category"] = -26;
                if (!keepTexture)
                {
                    foreach (string field in new[] { "texture", "spriteIndex" })
                    {
                        if (product[field] is { } value) item[field] = value.DeepClone();
                        else item.Remove(field);
                    }
                }
                string? color = tinted ? (source["tags"] as JArray)?.Select(TextValue).Select(tag => Colors.GetValueOrDefault(tag)).FirstOrDefault(c => c != null) : null;
                if (color != null) item["color"] = color;
                item["unpreservedItemId"] = source["_key"]!.DeepClone();
                item["preservedItemName"] = product["name"]!.DeepClone();
                yield return item;
            }
        }
        static string TextValue(JToken t) => Text(t);
        bool Category(JObject o, int category) => Number(o["category"]) == category;
        bool Named(JObject o, string[] names) => names.Contains(Text(o["name"]));
        return Make("Smoked", o => Category(o, -4), "Smoked", true, 1.5, p => Math.Floor(p * 2), keepTexture: true)
            .Concat(Make("DriedMushrooms", o => Category(o, -81) && Named(o, ["Chanterelle", "Common Mushroom", "Morel", "Magma Cap", "Purple Mushroom"]), "Dried", true, 3, p => Math.Floor(p * 1.5 + 5) * 5, tinted: true))
            .Concat(Make("DriedFruit", o => Category(o, -79) && Text(o["name"]) != "Grapes", "Dried", true, 3, p => Math.Floor(p * 1.5 + 5) * 5, tinted: true))
            .Concat(Make("Wine", o => Category(o, -79), "Wine", false, 1.75, p => Math.Floor(p * 3), tinted: true))
            .Concat(Make("Pickles", o => (Category(o, -75) || Category(o, -81) && Number(o["edibility"]) > 0) && !Named(o,
                ["Cave Carrot", "Chanterelle", "Common Mushroom", "Dandelion", "Ginger", "Hazelnut", "Leek", "Magma Cap", "Morel", "Purple Mushroom", "Snow Yam", "Spring Onion", "Wild Horseradish", "Winter Root"]), "Pickled", true, 1.75, p => Math.Floor(p * 2.25), tinted: true))
            .Concat(Make("Jelly", o => Category(o, -79), "Jelly", false, 1.75, p => Math.Floor(p * 2.25), tinted: true))
            .Concat(Make("Juice", o => (Category(o, -79) || Category(o, -81)) && !Named(o,
                ["Chanterelle", "Common Mushroom", "Magma Cap", "Morel", "Purple Mushroom", "Red Mushroom", "Wheet", "Hops", "Tea Leaves"]), "Juice", false, 2, p => Math.Floor(p * 2.25), tinted: true));
    }
}
