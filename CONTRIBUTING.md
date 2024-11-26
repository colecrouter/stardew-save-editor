# Contributing

This project is built in NodeJS, with [Svelte 5](https://svelte.dev/) and [SvelteKit](https://svelte.dev/docs/kit/introduction).

## Development

### Getting Started

-   Clone the project
-   Install the NodeJS version 20, 22, or later
-   Run `npm install`

### Local Development

Run `npm run dev` to start the local dev server.

### Updating Game Assets

Follow [these](https://stardewvalleywiki.com/Modding:Editing_XNB_files#Unpack_game_files) instructions to unpack the game files. Put them in a `content` folder at the root of the project (eg. `content/Characters/Abigail.png`).

Then run `npm run dump`.

If you need assets that aren't copied from that command, you can modify it in `src/dump.ts`.

### Reading the Save File

The save format is somewhat inconsistent (in structure and consistency). My recommendation is to use a website like [this](https://jsonformatter.org/xml-parser) to format the save file into something more readable, then use a text editor to search for the data you need.

## Making Changes

If you want to make a contribution, just make a pull request.

### Code Style

This project uses BiomeJS for linting, and for formatting JS/TS files. Prettier is used for formatting markup files. You can run `npm run lint:fix` to check for linting errors, and `npm run format:fix` to format the files.
