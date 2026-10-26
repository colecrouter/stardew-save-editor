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
and collapsible creation settings. Narrow screens use a collapsible section menu, stacked settings and side-by-side
weather choices. Inventory, equipment,
item editing and character controls also reflow on narrow screens.

`EditorShell` composes the header, wood lattice and workspace. The current wood
uses the user's three original frame/post PNGs at integer 3x scale. `StudyFrame`
keeps corner seams separate from repeating edge strips; `WoodDivider` separates
end caps from repeated middles. `ParchmentPane` uses a CSS fill and reduced logical-pixel rim around scrolling
contents. Its first 3x trial is described below; smaller panels remain unchanged.
`SectionLink` keeps selected-tab decoration behind native anchor contents.
Mobile replaces the vertical post with a horizontal rail. Locally bundled
Pixelify Sans/VT323 fonts and native checkbox behavior remain unchanged.

#### Fidelity ledger

| Area        | Study evidence                                                    | Implementation and deliberate differences                                                                                                                |
| ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition | Header, dark left rail, broad parchment work area                 | Container frame with header beam and inset workspace; mobile sections use a native disclosure.                                                           |
| Frame       | Detailed wood edges and brass-colored corners                     | User-authored frame/post PNGs at 3x, with fixed corners and repeating middles; parchment refinement is deferred.                                         |
| Palette     | Pale cream controls, warm paper, green export, blue selected date | Shared theme tokens and component styles reproduce this hierarchy.                                                                                       |
| Typography  | Pixel headings and narrower body/control lettering                | Pixelify Sans headings and VT323 body text; generated lettering has no exact font asset.                                                                 |
| Controls    | Labeled inputs, calendar grid, checkbox, weather selects          | Real native controls with existing validation and bindings; detailed explanations remain available in disclosures. Profit/monster help is shortened.     |
| Icons       | Illustrated navigation and farm heading                           | The softer illustrated raster atlas supplies navigation/domain icons; remaining actions/weather use temporary glyphs.                                    |
| Content     | Compact farm settings and collapsed creation options              | Existing date/forced-weather diagnostics retained; date help and forecast notes can expand. Existing farmer selection stays inside the workspace footer. |

This is the first implemented study slice, not completion of the entire V2 visual
milestone. Frame pieces are extracted directly from the study; icons remain reconstructed
interface artwork from the approved softer atlas. Further
screens still need their own content/layout work, complex selection evaluation,
and icon refinement. The shared shell must remain usable during that migration.

Validation of the native shell includes app TypeScript/Svelte and formatting
checks, a production build, deterministic raster verification and browser checks
at 320, 390, 768, 1280 and 1366px. The browser checks exercise mobile navigation,
year commit on blur, day selection, Space on the native checkbox, stationary
frame art while content scrolls, and export. The configured Sentry upload still
returns HTTP 403; the app build completes. Save-fixture warnings remain visible.

### Responsive shell and icon ownership

The editor reserves desktop viewport space for the frame and attribution. Content
and navigation scroll independently; expanded help and longer page content can
extend within the workspace. Below 900px, a native section disclosure replaces the
left navigation and the page scrolls normally. Calendar/farm panels stack at their
content breakpoints. This does not promise that every migrated page fits without
vertical scrolling or that mobile controls are identical to the study.

The softer illustrated icon atlas lives in `src/lib/ui/art`, with generation
briefs and original comparisons under `design/v2/study-assets-v1`. `StudyIcon`
uses one shared atlas URL and preserves its inspected source aspect ratio. A
separate width override must not clip the display box. The icon atlas remains
reconstructed art; it is not a substitute for domain-specific sprite rendering.
Fallback code glyphs supply actions/weather outside the sixteen-icon atlas.

Frame raster extraction and shared join geometry are described under
[Native frame extraction](#native-frame-extraction) and in the frame kit README.
Effect calendar state remains in the lab; these components do not own save state.

### Game asset implementation proof

The inventory lab retains a **Game frame and icons** shell (`?skin=game`).
`PixelFrame` assembles the game's dialogue frame from nine atlas regions;
`UIIcon` exposes named game sprites. The local decompiled `Game1.drawDialogueBox`
and `GameMenu.draw` establish the coordinates. The skills tab also draws a farmer
portrait, so its otherwise blank base cell is deliberately absent from this set.
This was the initial icon experiment; production now uses purpose-drawn small-grid
icons after review found the tab icons and reduced building texture unreadable.

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

### Operation-owned domain state

History now owns a separate plain JSON `domainState` record. Preparers can update
it alongside the document; undo/redo restores its before/after snapshots in the
same transaction as XML patches and identities. Domain-only changes are undoable
and advance the revision, with their semantic receipt retained even when the XML
patch is empty. Export/net review still use only the document.

Initial and prepared metadata must be plain JSON records. Invalid values are
rejected, not cleaned up by stringifying. The production watering planner's marks
pass this boundary directly. Metadata snapshots count toward the history byte
limit; they currently store full before/after values rather than metadata patches.
This may cost more for large provenance sets and remains part of retention testing.

Preparation receives cloned state, and the engine detaches results before
publication. Tests prove in-place adapter writes cannot escape failed groups,
retained drafts cannot mutate published state, and outer Effect transactions roll
back document/domain/history together. Oversized metadata preserves redo and
identities. Legacy adapters omitting the new field preserve its current value.
Eleven new Effect tests cover these contracts; the complete experiment suite is
78 tests (11 native and 67 Effect), with zero Effect diagnostics.

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

`planRainWatering` now prepares writes and explicit provenance. Marks contain
identities, contexts, kinds and original values, with no document references or
stored callbacks. They survive JSON serialization, including originally missing
values. Pre-watered targets and hidden soil are preserved. Removing rain restores
only unchanged, still-present targets in the edited outdoor context. Replacement
objects, intervening edits and moves into independent contexts are left alone.

The production adapter weakly associates IDs with live target objects. Reordering
and moving the same object between known valley locations retains identity;
removing or replacing it does not redirect restoration to its replacement or write
to an abandoned object. These weak associations do not survive document cloning.
The Effect calendar prototype now carries target bindings, ordinary choices and
watering provenance in cloned domain-state snapshots. Date/weather mutations
prepare all dependent XML writes and commit with history atomically. Shared
raw-document helpers also serve the production proxy; a differential test checks
complete document parity across date, season and weather changes.

Bindings use location/coordinate/building keys and exact non-watering fingerprints.
Array reordering is supported. Ambiguous targets or unannotated content/topology
changes are rejected before publication; undoing the conflicting edit restores
usable bindings. Byte-identical replacements cannot be inferred from XML. Future
farm operations need an explicit binding/provenance maintenance protocol. These
snapshots count toward history's byte budget but do not optimize heap usage.
The production UI has not migrated to the Effect session.

The local decompiled `Game1._newDayAfterFade` adds an important acceptance case:
rain watering visits every outdoor location whose own weather context is rainy,
not just the main farm. `GameLocation.IsRainingHere` reads that context's weather.
The editor now visits known outdoor locations in the edited Default context.
`generated/location-weather.json` is produced from `Data/Locations` creation
records and unpacked TMX map properties, validated against `Data/LocationContexts`.
The source game's top-level fallback is Default; Farm is created separately and
has an explicit generated entry. A changed location class or unknown name has no
inferred context and is left untouched. Runtime map patches from mods, unresolved
dynamic locations and nested locations remain outside this vanilla lookup; this
does not claim complete discovery of arbitrary modded weather contexts.

Six pure watering tests and three metadata tests cover preparation, serialized
provenance, multiple contexts, removed/replaced/moved targets, intervening edits,
duplicate identities and map-property extraction. All 24 calendar integration
tests pass, including export/reimport and two new cases for identity retention and
Forest/Island/Desert/indoor/unresolved scope. Native app and codegen checks pass.
All three remote checks passed on `358f853`. The calendar adapter increment passes
573 app tests and 78 experiment tests locally, including native Node execution,
multiplayer date mirrors, XML round trips, rollback, weather choices and cross-feature
transactions.

## Clean-checkout tooling

The first CI run found two local assumptions. Codegen imports unpacked game assets,
so its native check is now the explicit `check:codegen` command after asset setup.
The default app check does not require those untracked files. Lab commands run
root SvelteKit sync before building, because shared code can cause Vite to resolve
the generated root TypeScript configuration. Remote CI passed after publication.

The calendar adapter also brings shared save types into the experiment check.
Both experiment configurations include the existing content JSON declarations,
so unpacked game assets are not required. The test command runs root SvelteKit
sync before Vitest transforms shared source, matching the lab commands. Clean
archive validation covers these prerequisites without local game content.

### Native frame extraction

The current wood sources and fourteen generated slices live under
`src/lib/ui/frame/art/user/`. The three originals are copied intact from the user's
attachments. `design/v2/user-frame/extract.py` crops ten-pixel frame corners,
clean seven-pixel-thick frame edges and seven-pixel divider caps. No resampling
occurs during extraction. CSS renders all parts at exactly 3x and repeats middles
from top-left origins. Corners remain 30 by 30 CSS pixels at every breakpoint.
The script's `--check` mode verifies all generated bytes. Generated files are
committed; Pillow is only an optional asset maintenance dependency.

`StudyFrame` owns the outside silhouette, `WoodDivider` owns cap/middle placement,
and `EditorShell` owns the intersections. Divider caps overlap the outside wood;
mobile substitutes a horizontal rail for the vertical post. The existing
parchment, selected tab, field borders and close button are retained for later
visual work. The prior study extraction and its source remain in
`design/v2/frame-kit` for comparison; they no longer supply the active wood.

Browser checks cover 1366, 1280, 768, 390 and 320px widths with no horizontal page
overflow and invariant 30px corner patches. Desktop stays within the viewport;
mobile flows vertically. This is a rough structural frame pass, not a parchment
redesign or an Effect UI migration.

### Logical-pixel parchment trial

The workspace now uses eight reduced rim assets in `src/lib/ui/frame/art/parchment`.
Corners are 9-10 logical pixels and display at integer 3x, matching the wood kit.
Whole-block area reduction and one shared twelve-colour palette remove fine
upsampled detail. The background remains a CSS gradient, while only edge strips
repeat. Original crops are preserved. The optional reducer and its manifest/check
workflow are documented in `design/v2/parchment/README.md`.

This trial changes only the main workspace, not the field rims or selected tab.
Browser checks at 320-1366px confirm invariant image sizes, stationary rim art,
no horizontal overflow, no missing UI assets and no runtime errors. Native/Svelte,
formatting and build checks pass; Sentry upload retains the existing HTTP 403.
