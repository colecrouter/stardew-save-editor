# Appearance migration

The v2 Appearance section retains the legacy name, favorite thing, gender, skin,
hairstyle, accessory and eye/hair color controls. Farm name deliberately reuses
the Farm domain field: it remains one farm-wide action updating all farmer copies.
All other edits capture the selected farmer and use shared immediate fields.
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

Visual refinement is deferred with the rest of the v2 migration. Tests exercise
read-only projection, hair encoding, gender mirrors, color preservation, typed
rejections, farmer identity checks, shared selection and gesture Undo behavior.
