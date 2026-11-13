using System.Globalization;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using static AssetDump.CatalogGenerator;

namespace AssetDump;

internal static class GiftCatalog
{
    private sealed record Gift(string Name, string Id, int Category, string Type, double Edibility, double Price, string[] Tags);
    private static readonly string[] Order = ["love", "hate", "like", "dislike", "neutral"];
    private static readonly Dictionary<int, string> Categories = new()
    {
        [-2] = "Gem",
        [-4] = "Fish",
        [-5] = "Egg",
        [-6] = "Milk",
        [-7] = "Cooking",
        [-8] = "Crafting",
        [-9] = "BigCraftable",
        [-12] = "Mineral",
        [-14] = "Meat",
        [-15] = "MetalResources",
        [-16] = "BuildingResources",
        [-17] = "SellAtPierres",
        [-18] = "SellAtPierresAndMarnies",
        [-19] = "Fertilizer",
        [-20] = "Junk",
        [-21] = "Bait",
        [-22] = "Tackle",
        [-23] = "SellAtFishShop",
        [-24] = "Furniture",
        [-25] = "Ingredients",
        [-26] = "ArtisanGoods",
        [-27] = "Syrup",
        [-28] = "MonsterLoot",
        [-29] = "Equipment",
        [-74] = "Seeds",
        [-75] = "Vegetable",
        [-79] = "Fruit",
        [-80] = "Flower",
        [-81] = "Forage",
        [-95] = "Hat",
        [-96] = "Ring",
        [-97] = "Boots",
        [-98] = "Weapon",
        [-99] = "Tool",
        [-100] = "Clothing",
        [-101] = "Trinket",
    };
    private static string[] Split(string text) => text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
    private static string Words(string name) => Regex.Replace(name, "([a-z])([A-Z])", "$1 $2").Replace('_', ' ');
    private static readonly StringComparer NameOrder = StringComparer.Create(CultureInfo.GetCultureInfo("en"), false);

    private sealed class TasteRules
    {
        internal readonly Dictionary<string, string[]> Universal = new();
        internal readonly Dictionary<string, Dictionary<string, string[]>> Personal = new();
        private readonly Func<string, string?> qualify;

        internal TasteRules(JObject raw, Func<string, string?> qualify)
        {
            this.qualify = qualify;
            foreach (string taste in Order)
                Universal[taste] = Split(Text(raw["Universal_" + CultureInfo.InvariantCulture.TextInfo.ToTitleCase(taste)]));
            foreach (var pair in Entries(raw).Where(p => !p.Key.StartsWith("Universal_")))
            {
                // Dialogue and reference lists alternate in the legacy slash format.
                string[] fields = Text(pair.Value).Split('/');
                Personal[pair.Key] = new Dictionary<string, string[]>
                {
                    ["love"] = Split(fields.ElementAtOrDefault(1) ?? ""),
                    ["like"] = Split(fields.ElementAtOrDefault(3) ?? ""),
                    ["dislike"] = Split(fields.ElementAtOrDefault(5) ?? ""),
                    ["hate"] = Split(fields.ElementAtOrDefault(7) ?? ""),
                    ["neutral"] = Split(fields.ElementAtOrDefault(9) ?? "")
                };
            }
        }
        internal bool HasId(string entry, Gift gift) => !entry.StartsWith('-') && qualify(entry) == gift.Id;
        internal bool HasTag(string entry, Gift gift) => Regex.IsMatch(entry, @"^[^\d-]") && gift.Tags.Contains(entry);
        private static string? Pick(Dictionary<string, string[]> lists, Func<string, bool> matches, bool neutral = true) =>
            Order.Take(neutral ? 5 : 4).FirstOrDefault(taste => lists[taste].Any(matches));

        internal string Evaluate(string villager, Gift gift, bool ownTastes)
        {
            if (gift.Id == "(O)StardropTea") return "tea";
            // Category matching is textual: universal "0" also matches category 0.
            // Personal category overrides below deliberately exclude category 0.
            string category = gift.Category.ToString(CultureInfo.InvariantCulture);
            // Universal category, tag, and exact-ID rules apply in that order.
            // An exact universal ID also blocks a personal category override.
            string taste = Pick(Universal, entry => entry == category, false) ?? "neutral";
            taste = Pick(Universal, entry => HasTag(entry, gift), false) ?? taste;
            string? byId = Pick(Universal, entry => HasId(entry, gift));
            taste = byId ?? taste;
            // Artifacts override universal tastes, but personal rules still apply later.
            if (gift.Type == "Arch") taste = villager is "Penny" or "Dwarf" ? "like" : "dislike";
            // -300 means inedible rather than bad food. Exact universal neutrals
            // bypass the bad-food and cheap-item fallbacks.
            if (taste == "neutral" && byId != "neutral")
            {
                if (gift.Edibility != -300 && gift.Edibility < 0) taste = "hate";
                else if (gift.Price < 20) taste = "dislike";
            }
            if (ownTastes && Personal.TryGetValue(villager, out var lists))
                taste = Pick(lists, entry => HasId(entry, gift))
                    ?? Pick(lists, entry => HasTag(entry, gift))
                    ?? (byId == null && gift.Category != 0 ? Pick(lists, entry => entry == category) : null)
                    ?? taste;
            return taste;
        }
    }

    // The numeric taste values are the game's values; the catalog groups only
    // loves, but preserving all outcomes keeps precedence rules testable.
    internal static int Evaluate(JObject raw, string villager, JObject item)
    {
        var gift = new Gift("", Text(item["id"]), (int)Number(item["category"]), Text(item["type"]), Number(item["edibility"], -300), Number(item["price"]),
            (item["contextTags"] as JArray ?? []).Select(t => Text(t)).ToArray());
        var rules = new TasteRules(raw, id => id.StartsWith('(') ? id : "(O)" + id);
        return rules.Evaluate(villager, gift, true) switch { "love" => 0, "like" => 2, "dislike" => 4, "hate" => 6, "tea" => 7, _ => 8 };
    }

    internal static JObject Build(JObject raw, List<JObject> items, IEnumerable<string> villagers, Action<string[]>? reportUnmatched = null)
    {
        // ItemRegistry resolves unqualified IDs as objects before trying trinkets.
        var objectIds = items.Where(i => Text(i["_type"]) == "Object").Select(i => Text(i["_key"])).ToHashSet();
        var trinketIds = items.Where(i => Text(i["_type"]) == "Trinket").Select(i => Text(i["_key"])).ToHashSet();
        string? Qualify(string id) => id.StartsWith('(') ? id : objectIds.Contains(id) ? $"(O){id}" : trinketIds.Contains(id) ? $"(TR){id}" : null;
        var rules = new TasteRules(raw, Qualify);
        var universal = rules.Universal;
        var personal = rules.Personal;
        bool HasId(string entry, Gift gift) => rules.HasId(entry, gift);
        bool HasTag(string entry, Gift gift) => rules.HasTag(entry, gift);
        string Taste(string villager, Gift gift, bool own) => rules.Evaluate(villager, gift, own);

        // Rings, special interaction items and flavored duplicate products are
        // not normal gifts. Each base object or trinket is evaluated once.
        var notGifts = new HashSet<string> { "(O)897", "(O)809", "(O)458", "(O)277", "(O)460" };
        var gifts = new List<Gift>();
        foreach (var item in items)
        {
            string type = Text(item["_type"]);
            string[] tags = (item["tags"] as JArray ?? []).Select(t => Text(t)).ToArray();
            if (type == "Object")
            {
                string id = "(O)" + Text(item["_key"]);
                if (Truth(item["unpreservedItemId"]) || Text(item["type"]) == "Ring" || tags.Contains("not_giftable") || notGifts.Contains(id)) continue;
                gifts.Add(new Gift(Text(item["name"]), id, (int)Number(item["category"]), Text(item["type"]), Number(item["edibility"], -300), Number(item["price"]), tags));
            }
            else if (type == "Trinket")
                gifts.Add(new Gift(Text(item["name"]), "(TR)" + Text(item["_key"]), -101, "", -300, Number(item["price"]), ["category_trinket"]));
        }
        var result = new JObject();
        foreach (string villager in villagers)
        {
            if (!personal.TryGetValue(villager, out var lists))
            {
                result[villager] = Object(("loves", new JArray()), ("universalLoves", new JArray()));
                continue;
            }
            var universalLoves = new Dictionary<string, JObject>();
            var byEntry = new Dictionary<string, List<JObject>>();
            foreach (var gift in gifts)
            {
                string taste = Taste(villager, gift, true);
                var entry = Object(("name", Words(gift.Name)), ("item", gift.Name));
                if (taste == "tea" || taste == "love" && Taste(villager, gift, false) == "love")
                {
                    universalLoves[gift.Name] = entry;
                    continue;
                }
                if (taste != "love") continue;
                string key = lists["love"].FirstOrDefault(id => HasId(id, gift))
                    ?? lists["love"].FirstOrDefault(tag => HasTag(tag, gift)) ?? gift.Category.ToString(CultureInfo.InvariantCulture);
                if (!byEntry.TryGetValue(key, out var group)) byEntry[key] = group = [];
                if (!group.Any(e => Text(e["item"]) == gift.Name)) group.Add(entry);
            }
            var loves = new List<JObject>();
            var groups = new List<JObject>();
            foreach (var (key, values) in byEntry)
            {
                var sorted = values.OrderBy(e => Text(e["name"]), NameOrder).ToList();
                // Large personal categories appear once as "Any ..."; smaller
                // groups retain individual sprite keys and alphabetical labels.
                if (sorted.Count > 5)
                {
                    string label = key.StartsWith('-')
                        ? Words(int.TryParse(key, out int category) ? Categories.GetValueOrDefault(category, key) : key).ToLowerInvariant()
                        : Words(Regex.Replace(key, "_item$", ""));
                    groups.Add(Object(("name", "Any " + label), ("item", sorted[0]["item"]), ("items", sorted.Select(e => Text(e["name"])))));
                }
                else
                    foreach (var gift in sorted)
                        if (!loves.Any(e => Text(e["item"]) == Text(gift["item"]))) loves.Add(gift);
            }
            result[villager] = Object(("loves", loves.OrderBy(e => Text(e["name"]), NameOrder).Concat(groups.OrderBy(e => Text(e["name"]), NameOrder))),
                ("universalLoves", universalLoves.Values.OrderBy(e => Text(e["name"]), NameOrder)));
        }

        var references = universal["love"].Concat(personal.Where(p => villagers.Contains(p.Key)).SelectMany(p => p.Value["love"])).Distinct();
        var unmatched = references.Where(entry => !gifts.Any(gift => entry.StartsWith('-') && entry == gift.Category.ToString(CultureInfo.InvariantCulture) || HasId(entry, gift) || HasTag(entry, gift))).ToArray();
        reportUnmatched?.Invoke(unmatched);
        if (unmatched.Length > 0) Console.Error.WriteLine($"No giftable item for loved gifts: {string.Join(", ", unmatched)}");
        return result;
    }
}
