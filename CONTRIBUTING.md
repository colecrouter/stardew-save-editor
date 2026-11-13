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

If you need assets that aren't copied from that command, you can modify it in `tools/xnbhack/WorldCatalog.cs`.

`generated/buildings.json` includes what the editor needs to upgrade buildings (each building's
`buildingToUpgrade`, `validOccupantTypes`, doors, and the items the game adds or moves inside), taken
from `Data/Buildings` by `tools/xnbhack/WorldCatalog.cs`.

Villager descriptions aren't in the game files: `src/lib/wiki/villagers.json` is copied by hand from the [Stardew Valley Wiki](https://stardewvalleywiki.com) (CC BY-NC-SA 3.0), so edit it directly.

Event names aren't in the game files: they're kept by hand in `src/lib/wiki/events.json`, copied from the Stardew Modding Wiki's [List of Vanilla Event IDs](https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs) (CC BY-SA 4.0).

`generated/quests.json` is `Data/Quests`, parsed by `tools/xnbhack/QuestCatalog.cs` the way the game reads it
(`Quest.getQuestFromId`), so completing a story quest in the editor can start the next one.

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
npm run effect:diagnostics -- --project tests/engine/tsconfig.json
npm run check --prefix tests/engine
npm test --prefix tests/engine
```

Warnings and suggestions need contextual review: application boundaries may
legitimately run Effects, and the experiment deliberately evaluates unstable Atom
APIs. Errors fail checks; suggestions are shown by the diagnostic command without
turning every stylistic preference into a compiler failure.

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
`tests/engine` retains its own package and lockfile to verify the engine through
native Node imports as well as its Effect test adapter.

### Svelte checker compatibility

`svelte-check --tsgo` checks application and test components with native
TypeScript 7. The previous JavaScript-host symlink-cache backport is no longer
needed on this path. Keep the TypeScript 6 SDK installed: SvelteKit and editor
integrations still use its compiler API. The regular editor SDK and native
compiler SDK intentionally point to different installations.

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
- `src/lib/proxies`: temporary legacy editor compatibility, not the default engine.
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
