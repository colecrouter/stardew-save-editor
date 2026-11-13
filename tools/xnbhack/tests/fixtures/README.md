# Catalog regression cases

`catalog.json` contains the inputs and outputs exercised by the former TypeScript
extraction tests, captured before moving generation into .NET. They cover building
upgrades and materials, story quests, cooking outputs, localization, special-order
tokens, map contexts, gift precedence and grouped gift lists. They contain small
synthetic or previously maintained examples, not a game-content dump.

`CatalogTests` dispatches these cases directly to the production C# generator.
Keep expectations tied to the game's behavior; do not regenerate them from the
implementation under test. Whole-installation migration verification separately
compared all 11 generated JSON files semantically and all 106 copied images byte
for byte with the previous generator on Stardew Valley 1.6.8.
