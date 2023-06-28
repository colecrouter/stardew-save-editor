import { XMLParser } from 'fast-xml-parser';
import type { RequestEvent } from './$types';
import { error } from '@sveltejs/kit';

export const POST = async (event: RequestEvent) => {
    const file = event.request.body;
    if (!file) { throw error(400, "No file provided"); }

    // Big xml file, need to read it in chunks
    let xml = "";
    const reader = file.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            xml += value.toString();
        }
    } catch (e) {
        console.error(e);
        throw error(400, `Unable to parse file: ${(e as Error).message}`);
    }

    const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });
    const json = parser.parse(xml) as unknown;
    if (!isSaveFile(json)) { throw error(400, "Invalid save file"); }

    const gameVersion = json.SaveGame.gameVersion as string | undefined;
    if (!["1.5"].some((v) => gameVersion?.startsWith(v))) {
        throw error(400, `Unsupported game version: ${gameVersion}`);
    }

    // Get an array of player and farmhands
    // We have to apply a handful of changes to each of them, so it's easier to do it in a loop, rather than doing them separately
    const players = [json.SaveGame.player, ...json.SaveGame.locations.GameLocation.find((loc) => loc.name === "Farm")?.buildings?.Building.map((b) => b.indoors?.farmhand!).filter((f) => f) ?? []];

    // Type safety enhancements
    // 1. Inventory, switch <string xsi:nil="true" /> into undefined
    players.forEach((player) => player.items.Item = player.items.Item.map((item) => JSON.stringify(item) === '{"@_xsi:nil":"true"}' ? undefined : item));
    // 2. For some reason, if your character knows only 1 crafting or cooking recipe, it will be an object, not an array
    players.forEach((player) => {
        if (player.craftingRecipes?.item && !Array.isArray(player.craftingRecipes.item)) {
            player.craftingRecipes.item = [player.craftingRecipes.item];
        }
        if (player.cookingRecipes?.item && !Array.isArray(player.cookingRecipes.item)) {
            player.cookingRecipes.item = [player.cookingRecipes.item];
        }
    });

    return new Response(JSON.stringify(json, null, 2));
};

const isSaveFile = (obj: unknown): obj is SaveFile => {
    return typeof obj === "object"
        && obj !== null
        && "SaveGame" in obj
        && typeof obj.SaveGame === "object"
        && obj.SaveGame !== null;
};