using Newtonsoft.Json.Linq;

namespace AssetDump;

internal sealed partial class CatalogGenerator
{
    internal static JArray PetAppearances(JObject source)
    {
        // Breed IDs are opaque strings, not positions. Include every appearance
        // independently of starter/adoption eligibility, including both turtles.
        var result = new JArray();
        foreach (string type in new[] { "Cat", "Dog", "Turtle" })
        {
            if (source[type]?["Breeds"] is not JArray breeds || breeds.Count == 0)
                throw new InvalidDataException($"Missing breeds for {type}.");
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var breed in breeds)
            {
                if (breed is not JObject || breed["Id"]?.Type != JTokenType.String ||
                    string.IsNullOrEmpty(Text(breed["Id"])) || !seen.Add(Text(breed["Id"])))
                    throw new InvalidDataException($"Invalid or duplicate {type} breed ID.");
                // Reject changed sheet layouts rather than publishing broken previews.
                var rect = breed["IconSourceRect"] as JObject;
                bool Coordinate(JToken? value) => value?.Type == JTokenType.Integer &&
                    value.Value<double>() >= 0 && value.Value<double>() <= 9007199254740991;
                if (rect == null || Number(rect["Width"]) != 16 || Number(rect["Height"]) != 16 ||
                    !Coordinate(rect["X"]) || !Coordinate(rect["Y"]))
                    throw new InvalidDataException($"Unsupported icon rectangle for {type}/{breed["Id"]}.");
                string sheet = Text(breed["IconTexture"]);
                if (sheet != @"LooseSprites\Cursors" && sheet != @"LooseSprites\Cursors_1_6")
                    throw new InvalidDataException($"Unsupported icon sheet for {type}/{breed["Id"]}.");
                result.Add(Object(("petType", type), ("breedId", breed["Id"]),
                    ("icon", Object(("sheet", "/assets/" + sheet[@"LooseSprites\".Length..] + ".png"),
                        ("x", rect["X"]), ("y", rect["Y"])))));
            }
        }
        return result;
    }
}
