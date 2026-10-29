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
npm run effect:diagnostics -- --project experiments/v2/tsconfig.json
npm run check --prefix experiments/v2
npm test --prefix experiments/v2
```

Warnings and suggestions need contextual review: application boundaries may
legitimately run Effects, and the experiment deliberately evaluates unstable Atom
APIs. Errors fail checks; suggestions are shown by the diagnostic command without
turning every stylistic preference into a compiler failure.

Start with the [current V2 status and conventions](docs/v2-status.md).
The [V2 implementation requirements](docs/v2-implementation.md) and
[editor blueprint](docs/v2-editor-blueprint.md) describe the active migration.
The calendar workflow now lives in `src/lib/editor` and the `/v2` application route.
Run `npm run test:editor` for its migrated tests, or `npm test` for the full suite.
The lab forwards to the application-owned implementation. See the
[calendar migration](docs/v2-calendar-migration.md) for legacy isolation and retirement gates.

### Native structured cloning

The browser baseline includes Safari/iOS 15.4 and native `structuredClone`.
`npm ci`/`npm install` runs `tools/patch-core-js.mts` to adjust core-js 3.46.0's
replacement policy: lack of proposed AggregateError serialization alone must not
replace native cloning. Loss of core-js-added DOMException stacks is also accepted.
Ordinary Error stacks, DOMException types/shared references, and the missing-native
fallback remain checked. Automatic polyfill selection stays enabled.
The script checks the installed version and exact source, and fails installation
on drift; review and update the patch when upgrading core-js. Do not bypass that
failure or remove the patch without checking the generated production polyfills.

## General Conventions

The code is broken up into a few sections.

- `src/lib`: Contains the core code.
  - `src/lib/proxies`: Contains reactive proxy classes for interacting with save data.
  - `src/lib/ui`: Contains reusable Svelte components used throughout the app.
  - `src/lib/worker`: Contains web worker scripts for offloading heavy computations.
- `src/routes`: Contains routes & page components for the SvelteKit app.
- `codegen`: Contains code/asset generation scripts and utilities.
- `generated`: Output from code generation scripts.
- `tests`: Contains unit and integration tests for the application.
- `static`: Contains static assets such as images, fonts, and other files served directly by the app.

### Proxies

The current model uses Svelte's reactivity system to create "wrappers" around existing save data. They serve 2 purposes:

1. Abstract away gross-or-weird requirements for interacting with the save data.
1. Provide reactivity, so that the Svelte app automatically updates when the underlying save data changes.

Proxies can contain getters and setters to sanitize/validate data before it is written to the save file. However, this should be limited to simple checks (e.g. limiting string lengths, ensuring numbers are within a certain range, etc.). **Precedence should be given to implementing these limitations in UI components rather than in the proxies themselves.**

> Our goal isn't to create a 100%-safe, standalone API; it's to provide fallbacks in cases where we might forget/overlook validations in UI.

### Game Assets

As it stands, all game-derived content exists inside either `generated` or `static/assets` directories.

While ConcernedApe isn't known to DMCA fan content, we should at least avoid committing any unchanged assets (as they exist within the game's files) to this repository. If things get dire in the future, we should be able to remove these assets without too much hassle. Of course, that will impede ease of development.
