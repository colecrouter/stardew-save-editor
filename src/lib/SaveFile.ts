import type { Player } from "$types/save/1.6";
import { error } from "@sveltejs/kit";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { get, writable, type Readable, type Writable } from "svelte/store";

export const SaveGame = writable<SaveFile | undefined>();
export const FileName = writable<string | undefined>();

class CharacterSelector {
	private _character: Writable<Player | undefined>;
	private _save: Writable<SaveFile | undefined>;
	private _index: number;
	private _players: Array<Player>;

	constructor(save: Writable<SaveFile | undefined>) {
		this._save = save;
		this._character = writable<Player | undefined>();

		// Make ts happy
		this._index = 0;
		this._players = [];

		const currSave = get(save);

		// Set the initial value
		this.reset();

		// Subscribe to changes
		save.subscribe(this.reset);
	}

	private reset = () => {
		const save = get(this._save);

		// Reset the index when the save changes
		this._index = 0;

		if (!save) {
			return;
		}

		// Set the initial value to the first character
		this._character.set(save.SaveGame.player);

		// Set the players array, so we can iterate over it
		const farmers =
			save.SaveGame.farmhands.Farmer === undefined
				? []
				: Array.isArray(save.SaveGame.farmhands.Farmer)
					? save.SaveGame.farmhands.Farmer
					: [save.SaveGame.farmhands.Farmer];
		const player = save.SaveGame.player;
		this._players = [player, ...farmers];
	};

	public next = () => {
		this._index = (this._index + 1) % this._players.length;
		this._character.set(this._players[this._index]);
	};

	public prev = () => {
		this._index =
			(this._index - 1 + this._players.length) % this._players.length;
		this._character.set(this._players[this._index]);
	};

	public get character(): Readable<Player | undefined> {
		return this._character;
	}
}

export const Character = new CharacterSelector(SaveGame);

export const Download = async (save: SaveFile, filename: string) => {
	if (!save || !filename) {
		throw new Error("Save or filename is undefined");
	}

	const blob = await SaveConverter.toXML(save);

	// If supported, use file picker
	if ("showSaveFilePicker" in window) {
		const handle = await window.showSaveFilePicker({
			types: [
				{
					description: "Stardew Valley Save File",
					accept: { "text/text": [] },
				},
			],
			suggestedName: filename,
		});
		const writable = await handle.createWritable();
		await writable.write(blob);
		await writable.close();
		return;
	}

	// Otherwise just download the file to downloads
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
	a.remove();
};

export const SaveConverter = {
	toJSON: async (file: File): Promise<SaveFile> => {
		if (!file) {
			throw new Error("No file provided");
		}

		// Big xml file, need to read it in chunks
		// let xml = "";
		// const reader = file.getReader();
		// try {
		//     while (true) {
		//         const { done, value } = await reader.read();
		//         if (done) break;
		//         xml += value.toString();
		//     }
		// } catch (e) {
		//     console.error(e);
		//     throw error(400, `Unable to parse file: ${(e as Error).message}`);
		// }

		const xml = await file.text();

		const parser = new XMLParser({
			ignoreAttributes: false,
			allowBooleanAttributes: true,
		});
		const json = parser.parse(xml) as unknown;
		if (!isSaveFile(json)) {
			throw error(400, "Invalid save file");
		}

		const gameVersion = json.SaveGame.gameVersion as string | undefined;
		if (!["1.6"].some((v) => gameVersion?.startsWith(v))) {
			throw new Error(`Unsupported game version: ${gameVersion}`);
		}

		// Get an array of player and farmhands
		// We have to apply a handful of changes to each of them, so it's easier to do it in a loop, rather than doing them separately
		const farmers =
			json.SaveGame.farmhands.Farmer === undefined
				? []
				: Array.isArray(json.SaveGame.farmhands.Farmer)
					? json.SaveGame.farmhands.Farmer
					: [json.SaveGame.farmhands.Farmer];
		const player = json.SaveGame.player;
		const players = [player, ...farmers];

		// Type safety enhancements
		for (const player of players) {
			// 1. Inventory, switch <string xsi:nil="true" /> into undefined
			// Need to check for null, because undefined gets converted to null when JSON is stringified
			player.items.Item = player.items.Item.map((item) =>
				JSON.stringify(item) === '{"xsi:nil":"true"}' ? undefined : item,
			).filter((item) => item !== undefined);
			// 2. For some reason, if your character knows only 1 crafting or cooking recipe, it will be an object, not an array
			if (
				player.craftingRecipes?.item &&
				!Array.isArray(player.craftingRecipes.item)
			) {
				player.craftingRecipes.item = [player.craftingRecipes.item];
			}
			if (
				player.cookingRecipes?.item &&
				!Array.isArray(player.cookingRecipes.item)
			) {
				player.cookingRecipes.item = [player.cookingRecipes.item];
			}
		}

		return json;
	},
	toXML: async (json: SaveFile): Promise<Blob> => {
		if (!json) {
			throw new Error("No file provided");
		}
		console.log(json);
		if (
			!json ||
			typeof json !== "object" ||
			!("gameVersion" in json.SaveGame)
		) {
			throw new Error("Not valid save file");
		}

		// Get an array of player and farmhands
		// We have to apply a handful of changes to each of them, so it's easier to do it in a loop, rather than doing them separately
		const farmers =
			json.SaveGame.farmhands.Farmer === undefined
				? []
				: Array.isArray(json.SaveGame.farmhands.Farmer)
					? json.SaveGame.farmhands.Farmer
					: [json.SaveGame.farmhands.Farmer];
		const player = json.SaveGame.player;
		const players = [player, ...farmers];

		// Undo type safety enhancements
		// 1. Inventory, switch undefined into <string xsi:nil="true" /> (for farmhands, too) (flags too)
		// To be honest this is all kind of a hack. Realistically, we need something to parse through each node and convert
		// undefined to the appropriate xsi:nil attribute, but I couldn't find such a feature in fast-xml-parser
		for (const player of players) {
			const flags = [
				"canUnderstandDwarves",
				"hasRustyKey",
				"hasClubCard",
				"hasSpecialCharm",
				"hasSkullKey",
				"hasMagnifyingGlass",
				"hasDarkTalisman",
				"hasMagicInk",
				"HasTownKey",
			] satisfies Array<keyof Player>;
			for (const flag of flags) {
				if (player[flag] === null) {
					// @ts-expect-error
					player[flag] = { "@_xsi:nil": "true" };
				} else {
					delete player[flag];
				}
			}

			// @ts-expect-error
			player.items.Item = player.items.Item.map((item) =>
				item === undefined ? { "@_xsi:nil": "true" } : item,
			);
			// @ts-expect-error
			player.items.Item = player.items.Item.map((item) =>
				"which" in item ? { ...item, which: { "@_xsi:nil": "true" } } : item,
			);
			// 2. For some reason, if your character knows only 1 crafting or cooking recipe, it will be an object, not an array (we probably don't need to undo this)
			for (const recipe of [player.craftingRecipes, player.cookingRecipes]) {
				if (recipe?.item && !Array.isArray(recipe.item)) {
					recipe.item = [recipe.item];
				}
			}

			// Don't forget to add which nil="true" on hats;
			if (player.hat) {
				// @ts-expect-error
				player.hat.which = { "@_xsi:nil": "true" };
			}
		}

		// Copy name to Name, and stack to Stack for every item in the inventory
		// players.forEach((player) => [player.hat, player.pantsItem, player.shirtItem, player.boots, player.leftRing, player.rightRing, ...player.items.Item].forEach((item) => {
		//     if (item) {
		//         // @ts-expect-error
		//         item.Name = item.name;
		//         // @ts-expect-error
		//         item.Stack = item.stack;
		//         // @ts-expect-error
		//         item.Stackable = item.stackable;
		//     }
		// }));

		const builder = new XMLBuilder({
			attributeNamePrefix: "@_",
			ignoreAttributes: false,
			suppressUnpairedNode: false,
			suppressEmptyNode: true,
			suppressBooleanAttributes: false,
		});
		const raw = builder.build(json) as string;
		const xml = raw
			.split("------WebKitFormBoundary")[0]
			.trim()
			.replaceAll("&apos;", "'")
			.replaceAll("/>", " />");
		const blob = new Blob([xml], { type: "text/text" });

		return blob;
	},
};

const isSaveFile = (obj: unknown): obj is SaveFile => {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"SaveGame" in obj &&
		typeof obj.SaveGame === "object" &&
		obj.SaveGame !== null
	);
};
