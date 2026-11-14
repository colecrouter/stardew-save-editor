# Contributing

This project is built in NodeJS, with [Svelte 5](https://svelte.dev/) and [SvelteKit 3](https://svelte.dev/docs/kit/introduction).

## Development

### Quick Start

Use [NodeJS 24](https://nodejs.org/en/download/) (24.11 or later). CI uses the same
major version. npm installs the local [Vite+](https://viteplus.dev/) toolchain; a
global Vite+ installation is not required.

```bash
# Clone repository
git clone https://github.com/colecrouter/stardew-save-editor.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### Updating Game Assets

Install the .NET 8 SDK (or a newer SDK plus the .NET 8 runtime) and a
vanilla PC copy of Stardew Valley. Then run:

```bash
git submodule update --init --recursive tools/xnbhack/upstream
export STARDEW_GAME_PATH="/path/to/Stardew Valley"
npm run dump
```

On PowerShell, set `$env:STARDEW_GAME_PATH = "C:\path\to\Stardew Valley"`.
On macOS, point it at the directory containing `Stardew Valley.dll` inside the
app bundle. The command runs our [XnbHack integration](tools/xnbhack) directly,
including all transformations into `generated` and `static/assets`. SMAPI and
mods are not needed,
and nothing is installed into the game directory. The first run restores pinned
NuGet dependencies. On Windows, enable Developer Mode so the integration can
create its temporary Content link. XnbHack creates a temporary game instance,
so it needs a
working graphics display; on headless Linux, run `xvfb-run -a npm run dump` with
Mesa available.

Unpacked inputs, generated catalogs and selected textures are staged together.
They replace `content`, `generated` and `static/assets` only after extraction and
transformation succeed, with rollback if publication fails. Temporary exports use
`.cache/xnbhack`; build outputs stay under `tools/xnbhack/bin` and `obj`.
The upstream source is pinned as the `tools/xnbhack/upstream` Git submodule; its
MIT license is included there. Only running the asset dump requires initializing
this submodule. Normal app builds and the fixture-based asset tests do not.

`generated/location-weather.json` joins `Data/Locations`, `Data/LocationContexts`
and map-level `LocationContext` properties. XnbHack writes maps as TMX files under
`content/Maps`. The normal dump regenerates this lookup as well. App
checks and tests use the committed lookup and do not require unpacked maps.

`generated/pets.json` contains supported pet appearances and icon rectangles from
`Data/Pets`. The normal asset dump generates it and copies both cursor sheets.
See [asset extraction](tools/xnbhack/README.md) for provenance and generator tests.

If you need assets that aren't copied from that command, you can modify it in `tools/xnbhack/WorldCatalog.cs`.

`generated/buildings.json` includes what the editor needs to upgrade buildings (each building's
`buildingToUpgrade`, `validOccupantTypes`, doors, and the items the game adds or moves inside), taken
from `Data/Buildings` by `tools/xnbhack/WorldCatalog.cs`.

Villager descriptions aren't in the game files: `src/lib/wiki/villagers.json` is copied by hand from the [Stardew Valley Wiki](https://stardewvalleywiki.com) (CC BY-NC-SA 3.0), so edit it directly.

Event names aren't in the game files: they're kept by hand in `src/lib/wiki/events.json`, copied from the Stardew Modding Wiki's [List of Vanilla Event IDs](https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs) (CC BY-SA 4.0).

`generated/quests.json` is `Data/Quests`, parsed by `tools/xnbhack/QuestCatalog.cs` the way the game reads it
(`Quest.getQuestFromId`), so completing a story quest in the editor can start the next one.

### Progress diagnostics

`generated/progress.json` supplies vanilla shipping/fishing collection membership,
Perfection friendship thresholds, monster goals and saved achievement metadata.
The normal asset dump regenerates it through `tools/xnbhack/ProgressCatalog.cs`.
Its synthetic generator cases run with `npm run test:asset-dump`.

`src/lib/editor/progress-data.ts` reads committed saves without granting awards,
delivering mail or triggering endgame events. Perfection takes each customized
farmer's best whole category result, counts constructed buildings worldwide and
uses walnuts found rather than the spendable balance. Stardrops and monster goals
contribute only when their full category is complete; waivers add percentage points.
Missing or ambiguous evidence produces score bounds instead of fabricated zeros.
Stardrop mail checks use the host's active mailbox, matching a host-loaded save.
Mod-added requirements and runtime conditions are outside this vanilla calculation.

The Achievements view separates recorded game IDs from current requirement
diagnostics. Saved awards survive edits which lower the underlying progress;
platform unlock state cannot be inferred. Awards without a requirement evaluator
remain uncertain while showing their saved status. Museum donations and crop
membership come from `generated/achievement-requirements.json`; the asset dump
regenerates it with the other progress data. Power books follow the game's explicit
nineteen-stat list, excluding skill books and the Queen of Sauce cookbook.

Event checks use saved visit/movie/mine markers and the raccoon family's seven-day
growth delay. Fair and Luau scores are transient game-event state, so their recorded
awards are the only durable outcome evidence. An Infinity weapon in the selected
farmer's inventory is positive ownership evidence; absence cannot disprove past
ownership. Each historical fallback explains that evidence in the view instead of
inventing counters or treating platform unlocks as known. Tests belong in
`tests/editor/progress*.test.ts` and `achievement-diagnostics.test.ts`.

### Child editing

The Children tab under Relationships includes existing children from saved FarmHouse/Cabin character
lists, including nested building interiors. Renaming changes the exact saved
`name` and matching `friendshipData` and `giftedItems` keys for every saved farmer
in one transaction. Missing dictionaries stay absent; values, entry order,
parent IDs, hats, age, appearance and unknown data stay intact.

This contract was checked against the local decompiled source at
`82cfb6feb29e6d17ba2d394af4315b98467dd92f`: `Child` constructor,
`translateName`, `checkAction`, `doneTossing` and `canTalk`; `Character.displayName`
is XML-ignored and derived from the internal name. `Child.reloadSprite` can
repair a missing parent at runtime; the editor deliberately does not infer that
repair. `BirthingEvent` and `PlayerCoupleBirthingEvent` disambiguate internal
names with spaces. Existing trailing spaces are preserved when resolving old
keys; new names must have no surrounding whitespace or control characters.

`generated/character-names.json` contains sorted `Data/Characters` keys and is
regenerated by the normal asset dump. The initial keys were extracted from the
local unpacked vanilla data. They reserve names even for characters absent from
the save. Existing character names and destination friendship/gift-history keys
also prevent collisions; records are never merged. Ambiguous names, parents,
dictionaries, custom child classes and unsupported home types remain read-only.
Mod-defined references beyond these vanilla fields cannot be inferred.

Child portraits use the vanilla Baby/Toddler sheets copied by the asset dump.
They select an idle frame from the saved stage, gender and skin tone; unknown
representations retain an initial. Toddler portraits compose the front hat frame
with Child.draw's offset and first-frame hair crop. The searchable hat combobox
uses Inventory's catalog matching and item renderer; No hat has no item sprite.
These idle portraits do not simulate runtime animation. Both relationship tabs retain their mounted
controls, so switching tabs preserves private structured child drafts.

Edit child opens one draft for name, gender, skin tone, days old/development stage
and hat action. Apply submits only changed fields in one history transaction;
Cancel abandons them all. Keep hat preserves the exact imported record, including
custom metadata. Replacement uses the trusted Inventory factory; removal is explicit
and does not move the previous hat to inventory.

`Child.dayUpdate` increments `daysOld` then selects stages at 13, 27 and 55 days.
An explicit age edit writes `daysOld`, `age` and serialized `Speed` together (4 for
toddlers, 1 otherwise). It does not simulate overnight events, reposition the child,
reset daily interaction state, or rearrange beds. `GetChildIndex` sorts siblings by
age, so changing days can affect which bed the game assigns. Moving to a younger
development stage requires a saved crib in the home; edits within or advancing
from an existing stage do not introduce that requirement. Unknown saved stages
retain the strict crib check for ages under 55 days.
`Child.checkAction` equips hats only at stage 3; a younger
age with a saved hat requires explicit removal, and new hats require toddler stage.
Appearance/name edits alone preserve unfamiliar ages and hats. The age cap leaves
room for the next signed-Int32 day increment.

The form captures a revision on first input. Apply uses the command queue's
revision check plus the captured saved address, old name and parent ID, so edits
made while child details are being drafted require Cancel and a fresh draft. Each
successful Apply is one Undo entry; review shows edited fields and linked
relationship membership changes, with other serialized differences retained.

Automated coverage belongs in `tests/editor/children.test.ts`,
`children-edit.test.ts` and `children.svelte.test.ts`. For manual in-game validation, load exported
host/cabin and player-couple saves, verify child/social-page names and hearts,
interact with each parent/farmhand, check retained hats, sleep/save/reload, and
verify Undo/export restores the original child and progress. No physical-device,
screen-reader or in-game pass is implied by component/codec tests. Check each age
boundary, sprite/gender/skin changes, hats, a younger age with explicit hat removal,
and sibling beds across a day transition.

### Inspecting game assemblies

The standalone .NET CLI under `tools/game-data` inspects XML serialization
metadata, compares catalogs with saves, and generates typed TypeScript XML codecs.
See [game data tooling](tools/game-data/README.md) for setup, commands, input storage,
and validation limits. Asset extraction and catalog generation use `tools/xnbhack`
as described above.

The production editor imports the committed codec in `generated/save-format/save.ts`.
Regenerate it with `npm run game-data:generate -- --output generated/save-format/save.ts`.
Its browser runtime lives in `src/lib/save-format`; game assemblies are needed only
for regeneration, not ordinary builds. Editor models use plain arrays, dictionary
entries, null slots, and exact 64-bit integer values rather than XML wrappers.

### Reading the Save File

The save format is somewhat inconsistent (in structure and consistency). My recommendation is to use a website/tool to format the save file into something more readable, then use a text editor to search for the data you need. [Here is a tool for that](https://jsonformatter.org/xml-parser).

## Making Changes

If you want to make a contribution, just make a pull request.

### Code Style

Follow the explanatory-comment and readability requirements in [AGENTS.md](AGENTS.md).
Comments should describe the intended progression and assumptions so reviewers can
compare the implementation against that intent. Prefer expanded Svelte markup.
The v2 application editor and comparison UI use whitespace-insensitive HTML
formatting to keep tag delimiters readable. Keep Svelte control-flow blocks
and their elements on separate lines; use explicit spaces where inline whitespace
is meaningful.

Vite+ supplies the development server, production build, Vitest, Oxlint, and
Oxfmt through its local `vp` command. Keep using the npm scripts: `npm run dev`,
`npm run build`, `npm test`, and `npm run lint`. Run `npm run format` to format
TypeScript, Svelte, styles, and documentation, or `npm run format:check` to verify
formatting. Generated game data and assets are excluded. Linting and formatting
configuration live in `vite.config.ts`; Biome is no longer installed.

`npm run check` runs linting, native TypeScript checks for the app, tests, and
tooling, and native Svelte checks for application and test components. Use
`npm run check:types`, `npm run check:tests`, or `npm run check:tooling` for the
individual scopes. The separate TypeScript configurations keep browser globals
from silently acquiring Node declarations from test or build code. The root
`tsconfig.json` is an empty solution that lets editors discover the app, tests
and tooling projects. CLI checks target `tsconfig.app.json`,
`tsconfig.tests.json` and `tsconfig.node.json` directly; both Svelte configurations
stay at the repository root so native checking preserves component prop types. Run
`npm run check:asset-dump` and `npm run test:asset-dump` for the .NET generator;
these use synthetic fixtures and require no game installation. The native
TypeScript 7 compiler is installed as `@typescript/native`; the TypeScript 6 SDK
remains installed for integrations that need its JavaScript compiler API. Scripts
use an explicit native compiler path to avoid ambiguous `tsc` executable names.

Dependency installation configures Vite+ and patches the compiler integrations
with Effect language service support. Install the recommended VS Code extensions
and use the workspace TypeScript SDK; native TypeScript checking uses the separate
`@typescript/native` installation. When changing
Effect code, also inspect the complete diagnostic stream:

```bash
npm run effect:diagnostics:tests
npm run check:tests
npm test -- tests/engine
```

Warnings and suggestions need contextual review: application boundaries may
legitimately run Effects, and Atom integrations use unstable APIs. Errors fail
checks; suggestions are shown by the diagnostic command without turning every
stylistic preference into a compiler failure.

The editor lives in `src/lib/editor`. Domain views separate saved representations
from UI components. Independent edits publish valid changes immediately and group
text/number gestures into one Undo entry ending on blur; explicit drafts coordinate
consequences. Fallible work uses Effect; expected failures remain typed and defects
reach the shared reporting boundary. Keep projections pure and preserve unknown
saved data. Use existing field/controller and transaction helpers.

See [test commands and ownership](tests/README.md).

The app and its component tests share one npm installation because they use the
same application aliases and runtime dependencies. Separate tsconfigs provide
the required type boundaries without introducing packages solely for checking.
Engine contracts in `tests/engine` run in the root Vitest Node project, including
tests that use the Effect test adapter and real Node worker threads.

### Svelte checker compatibility

`svelte-check --tsgo` checks application and test components with native
TypeScript 7. The previous JavaScript-host symlink-cache backport is no longer
needed on this path. Keep the TypeScript 6 SDK installed: SvelteKit and editor
integrations still use its compiler API. The regular editor SDK and native
compiler SDK intentionally point to different installations.

### Toolchain timings

Run `npm run benchmark:toolchain -- /tmp/stardew-toolchain-benchmark` to record
sequential wall times and command logs. The test probe uses the same 34 tests and
two workers on both revisions. A separate `test-full-save` probe exercises the
public-save import/export preservation cases with one worker. Fixed worker counts
control these measurements only; regular test runs use Vitest's default concurrency.
The native and Svelte probes check both app and test scopes, with Node tooling
also included in the native probe.

For a revision without the harness, copy `scripts/benchmark-toolchain.mjs` outside
the checkout, install that revision with `npm ci`, and invoke the copy with Node
from the repository root. Use clean checkouts without a local
`.env.sentry-build-plugin`; the harness clears `SENTRY_AUTH_TOKEN` so authenticated
uploads do not affect build timings. Filesystem caches are not cleared. Each
command gets one local observation, not a statistical performance claim.
Committed observations and the compared revisions are in
[`benchmarks/toolchain.json`](benchmarks/toolchain.json). Those original observations
predate the `test-full-save` probe and do not establish codec performance parity.
The original artifact's `environment.node` records only the harness launcher's
version; child runtimes were not captured, so it does not establish that both
revisions ran every command on the same Node version. Vite+ can select a managed
Node independently of the launcher.

New harness results record `launcherNode`, actual per-command `nodeProcesses`,
and deduplicated `selectedNodes`, alongside revision, dirty-tree state and
CPU/memory metadata. A small Node startup preload writes each command's
`*.nodes.jsonl` journal; timings include that instrumentation overhead, while
journal parsing and log publication occur afterward. Existing `NODE_OPTIONS` are
preserved. Missing or unreadable provenance is reported and makes the harness
exit unsuccessfully; it never substitutes the launcher's version for a child.

### Native structured cloning

The browser baseline includes Safari/iOS 15.4 and native `structuredClone`.
`npm ci`/`npm install` runs `patch-package --error-on-fail` to apply
`patches/core-js+3.51.0.patch`, adjusting core-js 3.51.0's
replacement policy: lack of proposed AggregateError serialization alone must not
replace native cloning. Loss of core-js-added DOMException stacks is also accepted.
Ordinary Error stacks, DOMException types/shared references, and the missing-native
fallback remain checked. Automatic polyfill selection stays enabled.
Core-js is pinned to the reviewed version. Patch application failures fail installation;
review and regenerate the patch when upgrading core-js. Regression tests exercise
both the direct copy and the copy Vite resolves, so a future nested installation
cannot silently bypass the policy. Do not remove the patch without checking the
generated production polyfills.

## Source layout

- `src/lib/editor`: file-owned engine, domain views/commands and application UI.
- `src/lib/ui`: reusable controls and frame artwork.
- `src/lib/proxies`: legacy editor compatibility, not the default engine.
- `tools/xnbhack`: game-data extraction and catalog generation.
- `codegen`: application-facing catalog and save types.
- `generated`: committed game-data output.

Use UI-friendly immutable domain views rather than exposing raw save records to
components. Preserve unfamiliar imported data and validate each supported mutation
without normalizing unrelated records. File scopes own subscriptions and queued
commands; unmount consumers before releasing their registry.

## Game assets

Game-derived output belongs in `generated` or `static/assets`. Avoid committing
unchanged source game assets so they can be removed if required. Attribution and
use constraints belong with the maintained assets, not migration reports.
