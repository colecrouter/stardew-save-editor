# Shared controls and transactional operations

## Preferred visual direction

The approved study is the visual target: its colors, layout, typography, frames
and controls take precedence over literal reuse of the game's menu frame. The
atlas frame proved nine-slice rendering but was not visually preferred. Keep
game-derived iconography where it reads well, with coherent custom assets for
gaps. Responsive reflow and native control behavior remain requirements.

Use reusable pixel-edged frames, parchment surfaces, consistent spacing and
typography over semantic HTML. Frame artwork can be sliced into reusable corners
and edges; the layout and contents remain responsive. Prototype one frame and its
control states before applying that visual language throughout the editor.

Audit existing game sprites first for navigation, weather and domain imagery.
Create a coherent small pixel-art set for missing editor actions, using consistent
palette, source-pixel scale and optical size. Generated study icons are references,
not production-ready art. Choose sprites that read at their actual control size.

Keep the existing Sprite drawing knowledge and expose semantic icon definitions
for fixed navigation/actions. Item rendering still needs its game-specific layers
and state. Convenient factories remain available with correct ownership; static
chrome does not need to acquire item editing behavior just to draw an icon.

### Study implementation

The production editor now has a wide, parchment workspace, a dark wood navigation
rail, labeled section links, and a header with export and exit actions. Farm uses
the study's settings/date/weather columns, selected-day blue, information strip
and collapsible creation settings. Narrow screens use a scrollable navigation
rail, stacked settings and side-by-side weather choices. Inventory, equipment,
item editing and character controls also reflow on narrow screens.

`StudyFrame` uses an original, code-native nine-slice SVG with wood grain and
corner details. Theme tokens and locally bundled Pixelify Sans/VT323 fonts supply
consistent text, controls and surfaces. Font licenses are included alongside the
files; the fonts and frame do not require third-party requests. Checkbox controls
use native appearance, checked state and keyboard behavior.

#### Fidelity ledger

| Area        | Study evidence                                                    | Implementation and deliberate differences                                                                                                                    |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Composition | Header, dark left rail, broad parchment work area                 | Same container hierarchy; mobile rail scrolls within its own region.                                                                                         |
| Frame       | Detailed wood edges and brass-colored corners                     | Original SVG nine-slice; the game's flatter dialogue frame stays in the lab.                                                                                 |
| Palette     | Pale cream controls, warm paper, green export, blue selected date | Shared theme tokens and component styles reproduce this hierarchy.                                                                                           |
| Typography  | Pixel headings and narrower body/control lettering                | Pixelify Sans headings and VT323 body text; generated lettering has no exact font asset.                                                                     |
| Controls    | Labeled inputs, calendar grid, checkbox, weather selects          | Real native controls with existing validation and bindings; detailed explanations remain available in disclosures. Profit/monster help is shortened.         |
| Icons       | Illustrated navigation and farm heading                           | Existing game atlases replace generated icons; some related sections share a glyph. Custom gaps remain a design task.                                        |
| Content     | Compact farm settings and collapsed creation options              | Existing date/forced-weather diagnostics retained; date help and forecast notes can expand. Existing farmer selection remains available below the workspace. |

This is the first implemented study slice, not completion of the entire V2 visual
milestone. Exact generated artwork is not shipped as interface chrome. Further
screens still need their own content/layout work, complex selection evaluation,
and icon refinement. The shared shell must remain usable during that migration.

Validation: the full app run passed 560 tests and timed out in one existing Qi
quest test at five seconds while the production build was running. Its entire
34-test file passed on isolated retry. All 561 app tests therefore have a passing
result across the full run and retry. Type/Svelte and formatting checks pass; app
and lab builds complete. Sentry sourcemap upload still returns HTTP 403. Browser
checks cover date entry, day selection, Space on the native checkbox, creation
details, and five routes at 390px without page overflow. Calendar day targets are
approximately 42 by 48px at that width. The real fixture still produces existing
unknown-item/out-of-bounds warnings; no client runtime errors were observed.

### Game asset implementation proof

The inventory lab retains a **Game frame and icons** shell (`?skin=game`).
`PixelFrame` assembles the game's dialogue frame from nine atlas regions;
`UIIcon` exposes named game sprites. The local decompiled `Game1.drawDialogueBox`
and `GameMenu.draw` establish the coordinates. The skills tab also draws a farmer
portrait, so its otherwise blank base cell is deliberately absent from this set.
The production farm icon now uses the existing barn texture instead of the map tab.

`MenuTiles.png` comes from `content/Maps/MenuTiles.png`; the asset producer now
copies it alongside the existing Cursors atlas. A context provider supplies URLs,
letting the app resolve its deployment base and the isolated lab bundle assets.
Only the selected 20 kB menu atlas is added; no per-icon images are generated.
The plain lab does not fetch the PNGs until the game shell is displayed. Icons
share the existing Cursors, object, craftable, shirt and barn atlases.

The frame uses 64px corner pieces on desktop and 32px pieces on narrow screens,
with pixelated sampling and responsive HTML content. Decoration does not remount
the editable subtree. Tests verify atlas dimensions/bounds, accessible icon names,
and retention of a partially typed input while toggling the frame. Browser checks
covered both state adapters, draft conflicts, apply/undo/redo, a 390px layout with
no horizontal overflow, and native/Bits dialogs. Portalled dialogs target the
theme boundary so they retain the same colors and focus behavior.

This proves reusable artwork and interaction coexist; it is not the completed
redesign. Typography, navigation, control artwork/states and editor-action icons
still need design work. Native-size Playwright screenshots were used after two
shared-preview captures returned 640x400 images despite the desktop viewport.

## Production control consolidation

The calendar screen now uses the existing input/select components, a shared field
layout for labels and descriptions, and a plain variant of the existing button.
`controls.css` provides shared colors, borders, focus, disabled and invalid states.
Buttons preserve explicit accessible names, disable links functionally, expose
pending state, and provide 40px targets. Save uses the pending state during export.

The existing framed button appearance remains available. This is an incremental
component consolidation, not a decision to hand-build every complex interaction.
Comboboxes, searchable item selection and popovers still need library evaluation.
The current visual treatment is a regression baseline, not a final design or a
requirement to port the old UI one-to-one. V2 may adopt a more faithful in-game
appearance or a distinct, restrained editor identity with crisp pixel-art accents.

Narrow-screen checks exposed a fixed-width application shell and non-wrapping
navigation. The shell now stacks and navigation wraps; farm settings and field
layouts stack at narrow widths. The farm page fits a 390px viewport. Keyboard Tab
and Enter select days with visible focus; typed years commit on change, and fixed
festival weather remains disabled. Desktop and mobile rendering were inspected.

Vitest now processes imported CSS so the existing input appearance checks cover
the extracted stylesheet. Control tests cover label/description/error association,
explicit names, disabled links, and pending controls resuming activation.

## Effect operations and identity

The experiment supports placing a complete item record into an empty backpack
slot, removal, and movement into empty slots within or across farmer backpacks.
These are format-level operations, not a complete item-spawning catalog API.
Opaque mod fields and destination nil-marker fields survive transfers. Handles
travel with records; placed items receive new handles. Undo restores handles and
documents together; new branches do not reuse abandoned handles.

`EditorOperations` is an Effect Context service captured by a session. The default
preparer uses the existing isolated-document mutation protocol; a replaceable
service test rejects the second operation of a group and verifies complete
rollback. Preparers stage document changes; external side effects cannot be
rolled back by the managed transaction and belong outside preparation.

## History retention

History has entry-count and serialized-byte limits (default 100 entries and 8 MiB).
Accounting includes forward/reverse patches, identity maps, intents, actions and
the size field itself, measured in UTF-8. Oldest entries are evicted to meet both
limits. Original import data remains available for complete net review.

A single oversized operation is rejected before publication, preserving document,
identity, undo and redo state. The lab displays payload usage and lost undo depth.
This bounds serialized history payload, not JavaScript object overhead, baseline
storage, transient cloning, or total application heap. Budget and oversized-action
policy remain experiment choices to assess before production migration.

## Production lifetime repair

Factory-created items have independent Svelte roots. Save cleanup now releases
items currently owned by player and chest inventories, including the dev-restored
save path. Rejected inventory item creation releases the temporary root before
returning. A regression test retains item references after reset and verifies that
their effects no longer write into the abandoned document.

This addresses demonstrated ownership gaps. It does not establish heap bounds for
every proxy, icon, nested container, worker, or overlapping import.

## Calendar adapter finding

A fresh calendar proxy per command would lose domain state: chosen ordinary
weather and the provenance of soil/pet bowls watered by the editor. A date may
temporarily force festival weather, then need to restore the previous ordinary
choice. Taking rain away must dry only what the editor watered. Constructor-only
or XML-only history cannot reconstruct those decisions reliably.

Ordinary choices are now a serializable `CalendarWeatherChoices` value, and
`planCalendarWeather` prepares today's and tomorrow's weather without mutating
the document or those choices. The production proxy uses it. Pure tests cover
festival round trips, incompatible seasons, mod weather, and green rain.

The next calendar step is to extract watering provenance and document preparation,
then commit domain state and document changes together in the Effect session. Undo/redo
must restore both. Watering provenance needs stable targets through future farm
edits. No temporary proxy-per-command calendar bridge is included.

The local decompiled `Game1._newDayAfterFade` adds an important acceptance case:
rain watering visits every outdoor location whose own weather context is rainy,
not just the main farm. `GameLocation.IsRainingHere` reads that context's weather.
The current editor's watering helper only visits the farm. During extraction,
enumerate outdoor locations affected by the edited Default context, preserve
Island/other context weather, and exclude indoor locations and hidden soil.
Capture reversible targets with session identity rather than closures or array
positions. Test a farm plus another outdoor location, an indoor location, an
independent-weather location, pre-watered soil/bowls, and a target removed or moved
between rain and dry operations. A calendar port must not silently perpetuate the
farm-only approximation or apply valley rain to every location indiscriminately.

## Clean-checkout tooling

The first CI run found two local assumptions. Codegen imports unpacked game assets,
so its native check is now the explicit `check:codegen` command after asset setup.
The default app check does not require those untracked files. Lab commands run
root SvelteKit sync before building, because shared code can cause Vite to resolve
the generated root TypeScript configuration. Remote CI passed after publication.
