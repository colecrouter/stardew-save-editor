# Contributing

This project is built in NodeJS, with [Svelte 5](https://svelte.dev/) and [SvelteKit](https://svelte.dev/docs/kit/introduction).

## Development

### Quick Start

Make sure to have [NodeJS 20, 22, or later](https://nodejs.org/en/download/) installed.

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

If you need assets that aren't copied from that command, you can modify it in `src/dump.ts`.

### Reading the Save File

The save format is somewhat inconsistent (in structure and consistency). My recommendation is to use a website/tool to format the save file into something more readable, then use a text editor to search for the data you need. [Here is a tool for that](https://jsonformatter.org/xml-parser).

## Making Changes

If you want to make a contribution, just make a pull request.

### Code Style

This project uses BiomeJS for linting, and for formatting JS/TS files. Prettier is used for formatting markup files. You can run `npm run check` to check for linting errors, and `npm run format` to format the files.

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
