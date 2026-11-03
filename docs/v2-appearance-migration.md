# Appearance migration

Character's Profile & appearance tab retains the legacy name, favorite thing,
gender, skin, hairstyle, accessory and eye/hair color controls. Farm name lives
only in Farm settings. Appearance edits capture the selected farmer and use shared
immediate fields.
Text, number and native color picker input apply valid values immediately and
are grouped by the shared focus/blur Undo gesture. Gender uses a discrete select.

The domain adapter checks imported values independently. Merely opening the page
does not construct legacy proxies, normalize values, synchronize gender mirrors,
or fill color channels. Unknown custom numeric values remain visible and survive
unrelated edits. Explicit new choices use the legacy supported ranges. A gender
action synchronizes `gender` and `Gender`; hairstyle picker IDs 56–73 map to the
second save sheet starting at 100. RGB writes preserve alpha, opaque members and
the presence of the packed mirror, recomputing an existing packed value.

The read-only preview composes the existing farmer layers with catalog-based
clothing, hats and boots, without Item/Farmer/Color proxy lifetimes. Missing clothes
use display-only stand-ins as v1 did; unsupported imported equipment or custom
appearance indices produce a visible preview notice. Preview omissions never
change the saved item. Character appearance rendering is an approximation of the
legacy editor, rather than simulation of the game's full animation/hat logic.

The visual pass groups identity, style and color fields beside a framed mirror
preview in Character's profile tab. All controls capture the shared selected farmer. Names in the
new profile headings remain masked for telemetry. No new save representations,
input policies or renderer simulation rules are introduced. Tests exercise
read-only projection, hair encoding, gender mirrors, color preservation, typed
rejections, farmer identity checks, shared selection and gesture Undo behavior.

The preview always composes foot geometry from the separate boots sheets, even
when the equipment slot is absent or nil. The saved shoe palette is used when
supported; otherwise a display-only game-default palette keeps the feet visible.
The body sheets themselves end above the feet. Equipped boot colors retain their
existing precedence; no fallback is written to the save.

Desktop identity controls span the dresser, with Style and Colors beside each
other below. The preview column and total form width stay bounded so short fields
do not expand across the entire workspace. Narrow screens stack those groups.

## Unified Character navigation

Character owns the shared farmer selector and retained Profile & appearance /
Skills & progression tabs. Progression mounts on first visit and remains mounted
when hidden. Internal and workspace navigation explicitly end the active editing
gesture; changing tabs never creates an edit of its own. The separate Appearance
sidebar destination is retired. Clothing remains in Inventory, reached by an
explicit button from the preview. Legacy v1 routes are unchanged.

Skin, Hairstyle and Accessory have bounded previous/next controls beside the exact
editable number. Stepping is one discrete Undo action; typing retains the shared
focus/blur gesture policy. Unsupported imported numbers remain visible, and the
arrows do not wrap or silently normalize them.
