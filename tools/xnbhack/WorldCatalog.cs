using System.Buffers.Binary;
using System.Xml.Linq;
using Newtonsoft.Json.Linq;

namespace AssetDump;

internal sealed partial class CatalogGenerator
{
    private static readonly string[] AssetFiles = [
        "TileSheets/Craftables.png", "TileSheets/FreeCactuses.png", "TileSheets/furniture.png", "TileSheets/furniture_2.png",
        "TileSheets/furniture_3.png", "TileSheets/joja_furniture.png", "TileSheets/junimo_furniture.png", "TileSheets/retro_furniture.png",
        "TileSheets/wizard_furniture.png", "TileSheets/weapons.png", "TileSheets/tools.png", "TileSheets/Mannequins.png",
        "Characters/Farmer/pants.png", "Characters/Farmer/shirts.png", "Characters/Farmer/accessories.png",
        "Characters/Farmer/hairstyles.png", "Characters/Farmer/hairstyles2.png", "Characters/Farmer/hats.png",
        "Characters/Baby.png", "Characters/Baby_dark.png", "Characters/Toddler.png", "Characters/Toddler_dark.png",
        "Characters/Toddler_girl.png", "Characters/Toddler_girl_dark.png",
        "Maps/springobjects.png", "TileSheets/Objects_2.png", "LooseSprites/daybg.png", "LooseSprites/JunimoNote.png",
        "LooseSprites/font_colored.png", "LooseSprites/Cursors.png", "LooseSprites/Cursors_1_6.png", "Maps/MenuTiles.png"];

    private static (int Width, int Height) PngSize(string path)
    {
        // PNG's IHDR dimensions are big-endian integers at fixed offsets. Reading
        // just the header avoids loading a graphics device during catalog generation.
        using var input = File.OpenRead(path);
        Span<byte> header = stackalloc byte[24];
        input.ReadExactly(header);
        if (!header[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            throw new InvalidDataException($"Expected PNG: {path}");
        return (BinaryPrimitives.ReadInt32BigEndian(header[16..20]), BinaryPrimitives.ReadInt32BigEndian(header[20..24]));
    }

    private void CopyAssets()
    {
        // Keep the editor's maintained asset selection. Unpacked source files
        // remain outside the published assets; portraits retain their editor names.
        var dimensions = new List<JArray>();
        foreach (string path in AssetFiles)
        {
            string source = Path.Combine(content, path);
            string name = Path.GetFileName(path);
            File.Copy(source, Path.Combine(assets, name), overwrite: true);
            var size = PngSize(source);
            dimensions.Add(new JArray(name, Object(("width", size.Width), ("height", size.Height))));
        }
        Write("dimensions", dimensions.OrderBy(d => Text(d[0]), StringComparer.Create(System.Globalization.CultureInfo.GetCultureInfo("en"), false)));
        Directory.CreateDirectory(Path.Combine(assets, "portraits"));
        foreach (string villager in Villagers)
            File.Copy(Path.Combine(content, "Portraits", (villager == "Leo" ? "ParrotBoy" : villager) + ".png"), Path.Combine(assets, "portraits", villager + ".png"), overwrite: true);
        Directory.CreateDirectory(Path.Combine(assets, "buildings"));
        foreach (string path in Directory.EnumerateFiles(Path.Combine(content, "Buildings")))
            File.Copy(path, Path.Combine(assets, "buildings", Path.GetFileName(path)), overwrite: true);
    }

    internal static JObject? Point(JToken? point) => point is not JObject ? null : Object(("X", point["X"]), ("Y", point["Y"]));
    private JObject Building(string key, JObject data, Dictionary<string, string> names)
    {
        string? texture = Text(data["Texture"]).Split(['/', '\\']).LastOrDefault();
        texture = string.IsNullOrEmpty(texture) ? null : texture + ".png";
        // A nonempty source rectangle describes only the building region, so it
        // takes precedence over the dimensions of the complete texture sheet.
        var rectangle = data["SourceRect"] as JObject;
        if (rectangle != null && Number(rectangle["Width"]) <= 0 && Number(rectangle["Height"]) <= 0) rectangle = null;
        JObject? size = rectangle == null ? null : Object(("X", rectangle["Width"]), ("Y", rectangle["Height"]));
        string path = Path.Combine(assets, "buildings", texture ?? "");
        if (size == null && texture != null && File.Exists(path))
        {
            var dimensions = PngSize(path);
            size = Object(("X", dimensions.Width), ("Y", dimensions.Height));
        }
        var description = ResolveDescription(data["Description"]);
        var result = Object(("name", key), ("footprint", data["Size"]), ("texture", texture), ("textureSize", size),
            ("sourceRect", rectangle), ("maxOccupants", data["MaxOccupants"]), ("hayCapacity", data["HayCapacity"]),
            ("description", Truth(description) ? description : null), ("buildCost", Truth(data["BuildCost"]) ? data["BuildCost"] : null),
            ("buildMaterials", BuildMaterials(data["BuildMaterials"] as JArray, names)));
        result.Merge(BuildingUpgrade(data));
        return result;
    }

    internal static JArray BuildMaterials(JArray? materials, IReadOnlyDictionary<string, string> names)
    {
        // The catalog presents object names, not qualified IDs. Unknown materials
        // cannot be resolved into inventory items and are omitted consistently.
        var result = new JArray();
        foreach (var material in materials ?? [])
        {
            string id = Text(material["ItemId"]);
            if (id.StartsWith("(O)")) id = id[3..];
            if (names.TryGetValue(id, out string? name))
                result.Add(Object(("item", name), ("amount", Number(material["Amount"], 1))));
        }
        return result;
    }

    internal static JObject BuildingUpgrade(JObject data)
    {
        // Door rectangles in game data reduce to tile coordinates in saves.
        // Negative coordinates and empty optional lists mean no such capability.
        JObject? Door(JToken? door) => door is JObject && Number(door["X"]) >= 0 && Number(door["Y"]) >= 0 ? Point(door) : null;
        JToken? Nonempty(JToken? list) => list is JArray array && array.Count > 0 ? array : null;
        var items = new JArray((data["IndoorItems"] as JArray ?? []).Where(i => Truth(i["ItemId"]) && i["Tile"] is JObject).Select(i =>
            Object(("id", i["Id"]?.Type is not (null or JTokenType.Null) ? i["Id"] : i["ItemId"]), ("itemId", i["ItemId"]),
                ("tile", Point(i["Tile"])), ("indestructible", Truth(i["Indestructible"]) ? true : null))));
        var moves = new JArray((data["IndoorItemMoves"] as JArray ?? []).Where(i => i["Source"] is JObject && i["Destination"] is JObject).Select(i =>
            Object(("source", Point(i["Source"])), ("destination", Point(i["Destination"])),
                ("size", i["Size"] is JObject size && (Number(size["X"]) != 1 || Number(size["Y"]) != 1) ? Point(size) : null),
                ("unlessItemId", Truth(i["UnlessItemId"]) ? i["UnlessItemId"] : null))));
        return Object(("buildingToUpgrade", Truth(data["BuildingToUpgrade"]) ? data["BuildingToUpgrade"] : null),
            ("validOccupantTypes", Nonempty(data["ValidOccupantTypes"])), ("humanDoor", Door(data["HumanDoor"])),
            ("animalDoor", Door(data["AnimalDoor"])), ("indoorItems", Nonempty(items)), ("indoorItemMoves", Nonempty(moves)),
            ("addMailOnBuild", Nonempty(data["AddMailOnBuild"])));
    }

    internal static string MapContext(string xml, IReadOnlySet<string> contexts)
    {
        // Only direct map properties apply. Tile/layer properties must never
        // accidentally change the weather assigned to the whole location.
        var map = XDocument.Parse(xml).Root;
        if (map?.Name.LocalName != "map") throw new InvalidDataException("Missing map element");
        string? context = map.Element("properties")?.Elements("property").FirstOrDefault(p => (string?)p.Attribute("name") == "LocationContext")?.Attribute("value")?.Value;
        return context != null && contexts.Contains(context) ? context : "Default";
    }

    internal static JObject LocationWeather(JObject locations, JObject contexts, Func<string, string> load)
    {
        var valid = contexts.Properties().Select(p => p.Name).ToHashSet();
        string Context(string map)
        {
            string path = map.Replace('\\', '/');
            if (!path.StartsWith("Maps/") || path.Split('/').Contains("..")) throw new InvalidDataException($"Unexpected game map path: {map}");
            return MapContext(load(path), valid);
        }
        var result = new JObject();
        foreach (var pair in Entries(locations).OrderBy(p => p.Key, StringComparer.Ordinal))
        {
            var create = pair.Value?["CreateOnLoad"] as JObject;
            if (!Truth(create?["MapPath"])) continue;
            result[pair.Key] = Object(("context", Context(Text(create!["MapPath"]))),
                ("type", create["Type"]?.Type is not (null or JTokenType.Null) ? Text(create["Type"]).Split('.').Last() : "GameLocation"));
        }
        result["Farm"] = Object(("context", Context("Maps/Farm")), ("type", "Farm"));
        return result;
    }
}
