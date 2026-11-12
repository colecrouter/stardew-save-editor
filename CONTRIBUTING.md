# Contributing

This project is built in NodeJS, with [Svelte 5](https://svelte.dev/) and [SvelteKit](https://svelte.dev/docs/kit/introduction).

## Development

### Quick Start

Use [NodeJS 24](https://nodejs.org/en/download/). CI uses the same major version.

```bash
# Clone repository
git clone https://github.com/colecrouter/stardew-save-editor.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### Updating Game Assets

Follow [these instructions from the SDV Wiki](https://stardewvalleywiki.com/Modding:Editing_XNB_files#Unpack_game_files) to unpack the game files. Put them in a `content` folder at the root of the project (eg. `content/Characters/Abigail.png`).

Then run `npm run dump`.

`generated/location-weather.json` joins `Data/Locations`, `Data/LocationContexts`
and map-level `LocationContext` properties. Unpack maps as TMX files under
`content/Maps`. To regenerate only this lookup, run `npm run dump:location-weather`;
that script runs directly on Node 24. The normal dump includes it as well. App
checks and tests use the committed lookup and do not require unpacked maps.

If you need assets that aren't copied from that command, you can modify it in `codegen/dump.ts`.

`generated/buildings.json` includes what the editor needs to upgrade buildings (each building's
`buildingToUpgrade`, `validOccupantTypes`, doors, and the items the game adds or moves inside), taken
from `Data/Buildings` by `codegen/buildingUpgrade.ts`.

Villager descriptions aren't in the game files: `src/lib/wiki/villagers.json` is copied by hand from the [Stardew Valley Wiki](https://stardewvalleywiki.com) (CC BY-NC-SA 3.0), so edit it directly.

Event names aren't in the game files: they're kept by hand in `src/lib/wiki/events.json`, copied from the Stardew Modding Wiki's [List of Vanilla Event IDs](https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs) (CC BY-SA 4.0).

`generated/quests.json` is `Data/Quests`, parsed by `codegen/quests.ts` the way the game reads it
(`Quest.getQuestFromId`), so completing a story quest in the editor can start the next one.

### Inspecting game assemblies

The standalone .NET CLI under `tools/game-data` inspects XML serialization
metadata, compares catalogs with saves, generates typed TypeScript XML codecs, and wraps
StardewXnbHack for asset exports.
See [game data tooling](tools/game-data/README.md) for setup, commands, input storage,
and validation limits. It does not change the existing `content/` codegen workflow.

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

Oxfmt formats TypeScript, Svelte, styles, and documentation. Run `npm run format`
to write formatting and `npm run format:check` to verify it. Generated game data
and assets are excluded. Biome remains the linter while we assess replacement
lint coverage; it no longer formats files.

`npm run check` runs linting, native TypeScript 7 checks for the app,
and `svelte-check`. Run `npm run check:codegen` after unpacking the game assets;
codegen imports those untracked files, so this check cannot run on a clean CI
checkout. Svelte still uses the JavaScript TypeScript 6 SDK because it
needs the compiler API; the native compiler is installed as `@typescript/native`.
Scripts use an explicit compiler path to avoid ambiguous `tsc` executable names.

Dependency installation patches both compiler integrations with Effect language
service support. Use the workspace TypeScript SDK in your editor. When changing
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

### Svelte checker compatibility

`svelte-check` is pinned to 4.3.3 with a small `patch-package` backport in
`patches/svelte-check+4.3.3.patch`. Its base language-service host must pass
TypeScript's resolution iterators to the symlink cache, as its existing wrapper
already does. Without that change, some inferred component types trigger an
internal exception and can suppress real Svelte diagnostics. Installation fails
if the reviewed patch no longer applies; review it when updating the checker.
The application uses native TypeScript 7 checks and the TypeScript 6 SDK for Svelte.

### Native structured cloning

The browser baseline includes Safari/iOS 15.4 and native `structuredClone`.
`npm ci`/`npm install` runs `patch-package --error-on-fail` to apply
`patches/core-js+3.46.0.patch`, adjusting core-js 3.46.0's
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
- `codegen` and `generated`: game-data extraction and committed output.

Use UI-friendly immutable domain views rather than exposing raw save records to
components. Preserve unfamiliar imported data and validate each supported mutation
without normalizing unrelated records. File scopes own subscriptions and queued
commands; unmount consumers before releasing their registry.

## Game assets

Game-derived output belongs in `generated` or `static/assets`. Avoid committing
unchanged source game assets so they can be removed if required. Attribution and
use constraints belong with the maintained assets, not migration reports.
