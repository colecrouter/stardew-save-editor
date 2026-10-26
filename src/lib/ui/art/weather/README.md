# Weather forecast sprites

These are static first-frame crops of the game's forecast sprites, rendered at
native 13 x 13 pixels with integer 3x scaling (39 x 39 CSS pixels). No resampling,
AI generation, recolouring, hue filter, editable item instance, animation timer or
Svelte effect root is involved. The existing game-asset attribution applies.
Edit each PNG directly; clean builds do not need unpacked game content.

`TV.setWeatherOverlay` in the local decompiled source supplies these coordinates:

| PNG               | Atlas       | Rectangle (x, y, width, height) |
| ----------------- | ----------- | ------------------------------- |
| `sun.png`         | Cursors     | 413, 333, 13, 13                |
| `rain.png`        | Cursors     | 465, 333, 13, 13                |
| `storm.png`       | Cursors     | 413, 346, 13, 13                |
| `snow.png`        | Cursors     | 465, 346, 13, 13                |
| `wind-spring.png` | Cursors     | 465, 359, 13, 13                |
| `wind-fall.png`   | Cursors     | 413, 359, 13, 13                |
| `festival.png`    | Cursors     | 413, 372, 13, 13                |
| `green-rain.png`  | Cursors_1_6 | 178, 363, 13, 13                |

Wedding uses the heart from `DayTimeMoneyBox.draw`: Cursors at 317, 421, 12, 8,
padded into a 13px transparent canvas at (0, 2), without resizing. The ordinary
Cursors crops come from the committed `static/assets/Cursors.png`; green rain was
extracted from the local `content/LooseSprites/Cursors_1_6.png`.

The source TV backgrounds are retained as small forecast cards. `WeatherIcon`
selects fall leaves for fall wind, snow for winter wind and petals otherwise.
Green rain has its actual sprite. Unknown/modded weather gets a neutral question
mark instead of an inferred sunny forecast; the existing text remains visible.
Icons are decorative beside labelled weather controls and have empty alt text.
