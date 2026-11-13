using AssetDump;
using Newtonsoft.Json.Linq;
using static AssetDump.CatalogGenerator;

internal static class CatalogTests
{
    public static void Run()
    {
        // These small input/output cases were captured from the original focused
        // TypeScript tests before removing that implementation. They exercise the
        // C# code directly, without requiring copyrighted game data or a display.
        var cases = JArray.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "catalog.json")));
        foreach (var test in cases)
        {
            var args = (JArray)test["args"]!;
            JToken? actual = null;
            Exception? failure = null;
            try
            {
                object? result = Text(test["op"]) switch
                {
                    "petAppearances" => PetAppearances((JObject)args[0]),
                    "getBuildingUpgradeData" => BuildingUpgrade((JObject)args[0]),
                    "getBuildMaterials" => BuildMaterials(args[0] as JArray, ((JObject)args[1]).Properties().ToDictionary(p => p.Name, p => Text(p.Value))),
                    "parseQuest" => ParseQuest(Text(args[0]), Text(args[1])),
                    "getQuests" => Entries((JObject)args[0]).Select(p => ParseQuest(p.Key, Text(p.Value))).OfType<JObject>(),
                    "getCookingRecipeOutput" => CookingOutput(Text(args[0]), Text(args[1])),
                    "parseRequiredCount" => RequiredCount(Text(args[0])),
                    "localized" => LocalizedText(args[0].Type == JTokenType.Null ? null : Text(args[0]), key => args[1][key] as JObject),
                    "objective" => ObjectiveResolver(Text(args[0]), args[1] as JArray, (JObject)args[2])(Text(args[3])),
                    "objectiveFactory" => ValidateFactory(args),
                    "mapWeatherContext" => MapContext(Text(args[0]), ((JArray)args[1]).Select(t => Text(t)).ToHashSet()),
                    "weather" => LocationWeather((JObject)args[0], new JObject(((JArray)args[1]).Select(t => new JProperty(Text(t), new JObject()))), key => Text(args[2][key])),
                    "giftTaste" => GiftCatalog.Evaluate((JObject)args[0], Text(args[1]), (JObject)args[2]),
                    "gifts" => Gifts(args),
                    _ => throw new InvalidOperationException($"Unknown test {test["op"]}")
                };
                actual = result == null ? JValue.CreateNull() : JToken.FromObject(result);
            }
            catch (Exception error) { failure = error; }
            if (test["error"] is { } expectedError)
            {
                if (failure?.Message != Text(expectedError))
                    throw new Exception($"{test["name"]}: expected error {expectedError}, got {failure}");
            }
            else if (failure != null || !Equal(test["expected"], actual))
                throw new Exception($"{test["name"]} ({test["op"]}): expected {test["expected"]}, got {actual}. {failure}");
        }
        Console.WriteLine($"Passed: {cases.Count} catalog regression cases");
    }

    private static object? ValidateFactory(JArray args)
    {
        ObjectiveResolver(Text(args[0]), args[1] as JArray, (JObject)args[2]);
        return null;
    }
    private static JObject Gifts(JArray args)
    {
        string[] unmatched = [];
        var villagers = GiftCatalog.Build((JObject)args[0], ((JArray)args[1]).Cast<JObject>().ToList(), ((JArray)args[2]).Select(t => Text(t)), values => unmatched = values);
        return Object(("villagers", villagers), ("unmatched", unmatched));
    }
    internal static bool Equal(JToken? a, JToken? b)
    {
        if (a is JObject left && b is JObject right)
            return left.Count == right.Count && left.Properties().All(p => right.ContainsKey(p.Name) && Equal(p.Value, right[p.Name]));
        if (a is JArray xs && b is JArray ys) return xs.Count == ys.Count && xs.Zip(ys).All(pair => Equal(pair.First, pair.Second));
        if (a?.Type is JTokenType.Integer or JTokenType.Float && b?.Type is JTokenType.Integer or JTokenType.Float)
            return a.Value<double>() == b.Value<double>();
        return JToken.DeepEquals(a, b);
    }
}
