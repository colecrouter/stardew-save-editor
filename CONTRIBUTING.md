# Contributing

## Updating Game Assets

Follow [these](https://stardewvalleywiki.com/Modding:Editing_XNB_files#Unpack_game_files) instructions to unpack the game files. Put them in a `content` folder at the root of the project (eg. `content/Characters/Abigail.png`).

Then run `npm run dump`.

If you need assets that aren't copied from that command, you can modify it in `src/dump.ts`.

## Reading the Save File

The save format is really unorganized and poorly designed. My recommendation is to use a website like [this](https://jsonformatter.org/xml-parser) to format the save file into something more readable, then use a text editor to search for the data you need.

## Making Changes

If you want to make a contribution, just make a pull request.