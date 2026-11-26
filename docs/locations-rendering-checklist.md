# Locations rendering checklist

The farm map should explain what occupies a tile before the player tries to
place, move, or remove anything. A recognizable drawing or a labeled footprint
can satisfy that requirement. Editing support is tracked independently.

## Implemented today

- [x] Load the exported base map for all eight vanilla farm layouts on demand in
      the dev editor. Draw the grid over the map in saved tile coordinates.
- [x] Draw placed object inventory sprites at their saved dictionary keys. Show
      a marker when sprite art is unavailable and retain unreadable coordinates in
      the object list.
- [x] Show readable farm building footprints and use the shipped catalog for
      vanilla art. Buildings with opaque records or unreadable bounds are absent
      from the map.
- [x] Draw selection, proposed move footprints and door approaches, and removal
      highlights independently of the base map.

References · [Map loader](../src/lib/editor/location-map.ts) ·
[Save projection](../src/lib/editor/location-inspection.ts) ·
[Terrain projection](../src/lib/editor/location-terrain.ts) ·
[Viewport](../src/lib/editor/ui/LocationMapViewport.svelte) ·
[Building projection](../src/lib/editor/location-building-move.ts)

## Required for a readable farm map

- [ ] Project the visible saved scene independently of editing and removal
      eligibility. Carry the tile anchor, known footprint, display name, and
      drawing data so hit tests and placement feedback can refer to the same record.

### Ground and terrain

- [x] **Flooring and paths.** Draw each saved tile by material. A representative
      texture per material is enough. Use a labeled tile when the material is unknown.
- [x] **Tilled soil and crops.** Draw each HoeDirt tile and distinguish bare
      tilled soil from planted soil. A simple plant marker can cover every crop
      until crop-specific art is available.
- [x] **Grass, wild trees, fruit trees and bushes.** Project them from the save
      independently of Reclaim. Use representative spring art for known trees,
      grass and common bushes. Keep the saved footprint separate from canopy
      overhang and retain markers for unavailable art.
- [x] **Large obstacles and giant crops.** Use the full saved footprint for both
      eligible obstacles and records outside Reclaim's scope. A recognizable
      footprint can stand in for the exact sprite.
- [x] **Unknown terrain.** Show a neutral marker when an opaque terrain record
      has a readable dictionary key. Use a verified footprint where one is
      available. Keep unlocated records in inspection without assigning a tile.

References · [Generated save contracts](../generated/save-format/save.ts) ·
[Removal projection](../src/lib/editor/location-removal.ts) ·
[Placement occupancy](../src/lib/editor/location-placement.ts) ·
[Terrain feature source](<../StardewValleyDecompiled/Stardew Valley/StardewValley.TerrainFeatures>)
(local decompile, when present)

### Buildings and placed items

- [x] **Vanilla building sprites.** Reuse available building art beyond coops.
      Keep the footprint selectable and named if the sprite lookup fails.
- [x] **Building entrances.** Show the footprint and relevant door approaches
      when inspecting or moving a supported building (currently vanilla coops).
- [x] **Outdoor furniture.** Project readable saved bounds into the grid and
      draw the saved frame when it fits the shipped vanilla furniture sheet.
      Use a named footprint otherwise. Mirror flipped frames and keep art
      overhang separate from the occupied tiles.
- [ ] **Placed object art.** Use representative world sprites for common objects
      where inventory art is misleading. Idle craftables, isolated fence posts
      and closed gates have world frames. Exact connectivity and active states
      are still pending.
- [ ] **Overlap and hit testing.** Show ground under objects and make overlapping
      records individually reachable. Object and building selections show
      underlying flooring and furniture directly. Use saved footprints for location and
      placement, even where sprite art extends beyond them.

References · [Item visuals](../src/lib/editor/item-presentation.ts) ·
[Building sprites](../src/lib/ui/BuildingSprite.svelte) ·
[Building geometry](../src/lib/editor/location-building-move.ts) ·
[Placement occupancy](../src/lib/editor/location-placement.ts)

## Asset inputs

Use the existing building catalog and shipped atlases first. Workspace game
exports provide material and sprite definitions under
`content/Data/{FloorsAndPaths,Crops,WildTrees,FruitTrees,GiantCrops,Buildings}.json`.
Use the saved tile keys for placed objects and terrain, clump dimensions for
large obstacles, pixel bounds for furniture, and the saved tile rectangle for
buildings. A single sprite can extend above those bounds.

## Deferred fidelity

- [ ] Flooring joins, fence joins, soil edges, watering textures and precise
      crop artwork for every growth stage.
- [ ] Seasonal variants, animated water, effects, lighting, open door frames,
      and exact game draw order through overlapping scenery and entities.
- [ ] Moving farmers, NPCs and animals. Their runtime positions can change
      independently of the saved structures.
- [ ] Interiors, other outdoor locations, and custom map assets. Preserve the
      existing object inspection when a map layout cannot be resolved.
- [ ] Production asset packaging. The current preview reads a developer
      workspace export.

## Verification checklist

- [x] In RanchD, show the path at **(7, 14)** before previewing the coop at
      **(6, 14)**. The apparent footprint should agree with placement validation.
- [ ] In TestSave, distinguish soil and planted tiles, and show saved building
      footprints plus terrain that Reclaim preserves.
- [x] In RanchD at phone and desktop widths, inspect a placed object and the
      flooring underneath it, tap the second tile of the rotated bench footprint, and compare selected and proposed coop door approaches.
- [ ] Check the same map at phone and desktop widths. Select, pan and zoom,
      apply a supported edit, then Undo. Saved markers update without moving the
      camera or turning preview overlays into permanent scenery.
