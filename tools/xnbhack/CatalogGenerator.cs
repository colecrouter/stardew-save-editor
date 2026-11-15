using System.Globalization;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AssetDump;

/// <summary>Build the editor's compact catalogs from a complete vanilla unpack.</summary>
internal sealed partial class CatalogGenerator(string content, string generated, string assets)
{
    internal static readonly string[] Villagers = ["Abigail", "Alex", "Caroline", "Clint", "Demetrius", "Dwarf", "Elliott", "Emily", "Evelyn", "George", "Gus", "Haley", "Harvey", "Jas", "Jodi", "Kent", "Krobus", "Leah", "Leo", "Lewis", "Linus", "Marnie", "Maru", "Pam", "Penny", "Pierre", "Robin", "Sam", "Sandy", "Sebastian", "Shane", "Vincent", "Willy", "Wizard"];
    private readonly Dictionary<string, JObject?> strings = new();
    internal static string Text(JToken? value, string fallback = "") => value?.Type == JTokenType.Null ? fallback : value?.ToString() ?? fallback;
    internal static double Number(JToken? value, double fallback = 0) => value?.Type == JTokenType.Null || value == null ? fallback : value.Value<double>();
    internal static bool Truth(JToken? value) => value != null && value.Type != JTokenType.Null && (value.Type switch
    {
        JTokenType.Boolean => value.Value<bool>(),
        JTokenType.Integer or JTokenType.Float => value.Value<double>() != 0,
        JTokenType.String => value.ToString().Length != 0,
        _ => true
    });
    internal static JObject Object(params (string Key, object? Value)[] fields)
    {
        // A null C# value means an omitted/undefined field. An explicit JSON null
        // remains a JValue, preserving the existing catalog's source representation.
        var result = new JObject();
        foreach (var (key, value) in fields)
            if (value != null) result[key] = value is JToken token ? token.DeepClone() : JToken.FromObject(value);
        return result;
    }
    internal static IEnumerable<KeyValuePair<string, JToken?>> Entries(JObject value) => value.Properties()
        // JavaScript Object.entries enumerates integer keys before other keys.
        .OrderBy(p => uint.TryParse(p.Name, out uint n) && n != uint.MaxValue && n.ToString() == p.Name ? 0 : 1)
        .ThenBy(p => uint.TryParse(p.Name, out uint n) && n != uint.MaxValue && n.ToString() == p.Name ? n : 0)
        .Select(p => new KeyValuePair<string, JToken?>(p.Name, p.Value));
    private JObject Read(string path) => JObject.Parse(File.ReadAllText(Path.Combine(content, path + ".json")));
    private void Write(string name, object value) => File.WriteAllText(Path.Combine(generated, name + ".json"), JsonConvert.SerializeObject(value));
    internal static string? Texture(string? path) => string.IsNullOrEmpty(path) ? null : path.Replace("TileSheets", "").Replace("/", "").Replace("\\", "") + ".png";

    public void Generate()
    {
        Directory.CreateDirectory(generated);
        Directory.CreateDirectory(assets);
        // Preserve catalog order: base item families first, then derived artisan
        // variants. Names remain the editor's lookup keys, including duplicates.
        var allObjects = Transform(Read("Data/Objects"), "Object");
        var objects = allObjects.Where(o => Text(o["name"]) != "Stone" || Text(o["_key"]) == "390").ToList();
        var items = objects.Where(o => !new[] { "Dried", "Pickled", "Juice", "Jelly", "Smoked" }.Contains(Text(o["name"]))).ToList();
        items.AddRange(Transform(Read("Data/BigCraftables"), "BigCraftable"));
        items.AddRange(LegacyItems(Read("Data/Boots"), "Boots"));
        items.AddRange(Transform(Read("Data/Shirts"), "Shirt").Where(o => Text(o["name"]) != "Soft Edge Pullover"));
        items.AddRange(Transform(Read("Data/Pants"), "Pants"));
        items.AddRange(LegacyItems(Read("Data/Furniture"), "Furniture"));
        items.AddRange(LegacyItems(Read("Data/hats"), "Hat"));
        items.AddRange(Transform(Read("Data/Weapons"), "Weapon"));
        items.AddRange(Transform(Read("Data/Tools"), "Tool"));
        items.AddRange(ArtisanGoods(allObjects, objects));
        items.AddRange(Transform(Read("Data/Trinkets"), "Trinket"));
        items.AddRange(Transform(Read("Data/Mannequins"), "Mannequin"));
        // Resolve only description tokens, matching the editor's existing display contract.
        foreach (var item in items)
        {
            // Only descriptions were localized by the original catalog. Preserve
            // display-name tokens and absent descriptions for their existing consumers.
            var description = ResolveDescription(item["description"]);
            if (description == null) item.Remove("description");
            else item["description"] = description;
        }
        Write("iteminfo", items.Select(item => new JArray(item["name"]!.DeepClone(), item.DeepClone())));
        // Gift grouping depends on the completed item catalog, including base IDs.
        Write("gifttastes", GiftCatalog.Build(Read("Data/NPCGiftTastes"), items, Villagers));
        // Keep recipe knowledge, progress IDs, story quests and Qi orders in
        // separate compact lookups so views need not load the inventory catalog.
        var cooking = Read("Data/CookingRecipes");
        Write("cookingrecipes", Entries(cooking).Select(p => p.Key));
        Write("cookingrecipeoutputs", new JObject(Entries(cooking).Select(p => new JProperty(p.Key, CookingOutput(p.Key, Text(p.Value))))));
        Write("craftingrecipes", Entries(Read("Data/CraftingRecipes")).Select(p => p.Key));
        // Birth naming reserves all character-data keys, including characters
        // absent from the save and those outside the social-page villager list.
        Write("character-names", Entries(Read("Data/Characters")).Select(p => p.Key).Order(StringComparer.Ordinal));
        // Completion uses collection membership flags which are intentionally
        // absent from the inventory catalog; retain them in a small dedicated lookup.
        Write("progress", ProgressCatalog.Build(Read("Data/Objects"), Read("Data/Characters"), Read("Data/MonsterSlayerQuests"), Read("Data/Achievements")));
        Write("achievement-requirements", ProgressCatalog.AchievementRequirements(Read("Data/Objects"), Read("Data/Crops")));
        Write("quests", Entries(Read("Data/Quests")).Select(p => ParseQuest(p.Key, Text(p.Value))).OfType<JObject>());
        Write("qiquests", SpecialOrders(Read("Data/SpecialOrders"), Read("Strings/SpecialOrderStrings")));
        // Building dimensions come from the selected texture copies; weather
        // metadata instead joins map properties to the game's location catalog.
        CopyAssets();
        // Pet selection uses the same staged publication as its preview sheets.
        Write("pets", PetAppearances(Read("Data/Pets")));
        Write("farmanimals", Entries(Read("Data/FarmAnimals")).Select(p => Object(
            ("name", p.Key), ("displayName", p.Value!["DisplayName"]), ("requiredBuilding", p.Value["RequiredBuilding"]),
            ("house", p.Value["House"]), ("canReproduce", p.Value["CanGetPregnant"]),
            ("canEatGoldenCrackers", p.Value["CanEatGoldenCrackers"]?.Type is not (null or JTokenType.Null) ? p.Value["CanEatGoldenCrackers"] : true))));
        var names = objects.ToDictionary(o => Text(o["_key"]), o => Text(o["name"]));
        Write("buildings", Entries(Read("Data/Buildings")).Select(p => Building(p.Key, (JObject)p.Value!, names)));
        Write("location-weather", LocationWeather(Read("Data/Locations"), Read("Data/LocationContexts"), path => File.ReadAllText(Path.Combine(content, path + ".tmx"))));
    }

    private static readonly (string Source, string Target)[] ItemFields = [
        ("DisplayName", "displayName"), ("Description", "description"), ("Price", "price"), ("Type", "type"), ("Category", "category"),
        ("MenuSpriteIndex", "menuSpriteIndex"), ("UpgradeLevel", "upgradeLevel"), ("ClassName", "class"), ("Defense", "defense"),
        ("CanBeDyed", "canBeDyed"), ("IsPrismatic", "isPrismatic"), ("SalePrice", "salePrice"), ("CanBePlacedIndoors", "canBePlacedIndoors"),
        ("CanBePlacedOutdoors", "canBePlacedOutdoors"), ("IsLamp", "isLamp"), ("HasSleeves", "hasSleeves"), ("Edibility", "edibility"),
        ("MinDamage", "minDamage"), ("MaxDamage", "maxDamage"), ("Speed", "speed"), ("Knockback", "knockback"),
        ("CritChance", "critChance"), ("CritMultiplier", "critMultiplier"), ("AreaOfEffect", "areaOfEffect"), ("Precision", "precision")];

    internal static List<JObject> Transform(JObject data, string type) => Entries(data).Select(p =>
    {
        var source = (JObject)p.Value!;
        // Modern item families use named properties; older slash records below
        // deliberately keep their different field sets instead of inventing defaults.
        var item = Object(("_type", type), ("_key", p.Key), ("name", source["Name"] ?? source["ID"] ?? (JToken)p.Key));
        foreach (var (from, to) in ItemFields)
            if (source.TryGetValue(from, out var value)) item[to] = value.DeepClone();
        var texture = Texture(Text(source["Texture"]));
        if (texture != null) item["texture"] = texture;
        if ((source["SpriteIndex"] ?? source["SheetIndex"]) is { } index) item["spriteIndex"] = (source["SpriteIndex"] ?? source["SheetIndex"])!.DeepClone();
        if (source["AttachmentSlots"] is { } slots && Number(slots) != -1) item["attachmentSlots"] = slots.DeepClone();
        if (Truth(source["DefaultColor"])) item["defaultColor"] = source["DefaultColor"]!.DeepClone();
        if (Truth(source["ContextTags"])) item["tags"] = source["ContextTags"]!.DeepClone();
        return item;
    }).ToList();

    internal static IEnumerable<JObject> LegacyItems(JObject data, string type) => Entries(data).Select(p =>
    {
        var fields = Text(p.Value).Split('/');
        string Required(int i) => fields.ElementAtOrDefault(i) ?? throw new InvalidDataException($"{type} {p.Key}: missing field {i}");
        string? Optional(int i) => fields.ElementAtOrDefault(i);
        double Numeric(int i) => double.Parse(Required(i).Length == 0 ? "0" : Required(i), CultureInfo.InvariantCulture);
        var item = Object(("_type", type), ("_key", p.Key), ("name", Required(0)));
        if (type == "Boots")
        {
            item.Merge(Object(("description", Required(1)), ("defense", Numeric(3)), ("immunity", Numeric(4)),
                ("colorIndex", Numeric(5)), ("displayName", Required(6))));
        }
        else if (type == "Hat")
        {
            item.Merge(Object(("description", Required(1)), ("showRealHair", Optional(2) == "true"),
                ("skipHairstyleOffset", Optional(3) == "true"), ("displayName", Required(5)),
                ("spriteIndex", string.IsNullOrEmpty(Optional(6)) ? null : Numeric(6)), ("texture", Texture(Optional(7)))));
        }
        else
        {
            JObject? Size(int i)
            {
                var dimensions = Required(i).Split(' ');
                return dimensions[0] == "-1" ? null : Object(("width", double.Parse(dimensions[0], CultureInfo.InvariantCulture)),
                    ("height", double.Parse(dimensions[1], CultureInfo.InvariantCulture)));
            }
            item.Merge(Object(("type", Required(1)), ("tilesheetSize", Size(2)), ("boundingBoxSize", Size(3)),
                ("rotations", Numeric(4)), ("price", Numeric(5)), ("placementRestriction", Required(6) == "" ? -1 : Numeric(6)),
                ("displayName", Required(7)), ("texture", Texture(Optional(9))),
                ("spriteIndex", string.IsNullOrEmpty(Optional(8)) ? null : Numeric(8)), ("offLimitsForRandomSale", Optional(10) == "true")));
        }
        return item;
    });

    private JToken? ResolveDescription(JToken? description)
    {
        if (!Text(description).StartsWith("[LocalizedText ")) return description?.DeepClone();
        return LocalizedText(Text(description), asset =>
        {
            if (!strings.TryGetValue(asset, out var table))
            {
                string file = Path.Combine(content, asset.Replace('\\', '/') + ".json");
                strings[asset] = table = File.Exists(file) ? JObject.Parse(File.ReadAllText(file)) : null;
            }
            return table;
        });
    }

    internal static JToken? LocalizedText(string? text, Func<string, JObject?> load)
    {
        if (string.IsNullOrEmpty(text)) return null;
        var match = Regex.Match(text, @"^\[LocalizedText ([^:\]]+):([^\s\]]+)((?: [^\s\]]+)*)\]$");
        if (!match.Success) return null;
        if (load(match.Groups[1].Value)?[match.Groups[2].Value] is not { } value) return null;
        var args = match.Groups[3].Value.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return new JValue(Regex.Replace(Text(value), @"\{(\d+)\}", token => args.ElementAtOrDefault(int.Parse(token.Groups[1].Value)) ?? token.Value));
    }
}
