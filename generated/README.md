# Generated pet appearances

`pets.json` lists the vanilla `Data/Pets` type/breed pairs and their icon
rectangles. `npm run dump:pets` regenerates it from `content/Data/Pets.json` and
copies `content/LooseSprites/Cursors.png` and `Cursors_1_6.png` into `static/assets`.
The normal `npm run dump` includes this step. Development and CI use the committed
output and do not need unpacked game files.

The initial lookup and `Cursors_1_6.png` use the unmodified Stardew Valley 1.6.15
[data](https://github.com/wsir78933-rgb/stardew-planner/blob/984ba4a77ace42ec5c3dbf0b75ea23472b6f9b6d/public/game-assets/1.6.15/data/Pets.json)
and [cursor sheet](https://github.com/wsir78933-rgb/stardew-planner/blob/984ba4a77ace42ec5c3dbf0b75ea23472b6f9b6d/public/game-assets/1.6.15/tilesheets/Cursors_1_6.png)
mirrors. Only required lookup fields and the new sheet are committed; the existing
cursor sheet is unchanged. All game-derived data and artwork belong to
ConcernedApe and follow the repository's [game-asset policy](../README.md#legal),
not the code license.

The extractor includes all supported breeds, including turtles, without applying
starter-pet or adoption-shop filters. An appearance edit is neither adoption nor a
change to the farmer's preferred pet. Imported custom pairs remain visible but
are never added to the supported destination catalog.
