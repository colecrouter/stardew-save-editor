import { XMLBuilder } from 'fast-xml-parser';
import type { RequestEvent } from './$types';

export const POST = async (event: RequestEvent) => {
    const json = await event.request.json() as SaveFile;
    if (!json) return new Response("No file provided", { status: 400 });
    if (!json || typeof json !== 'object' || 'gameVersion'! in json) return new Response("Not valid save file", { status: 400 });

    // Get an array of player and farmhands
    // We have to apply a handful of changes to each of them, so it's easier to do it in a loop, rather than doing them separately
    const players = [json.SaveGame.player, ...json.SaveGame.locations.GameLocation.find((loc) => loc.name === "Farm")?.buildings?.Building.map((b) => b.indoors?.farmhand!).filter((f) => f) ?? []];

    // Undo type safety enhancements
    // 1. Inventory, switch undefined into <string xsi:nil="true" /> (for farmhands, too)
    // @ts-expect-error
    players.forEach((player) => player.items.Item = player.items.Item.map((item) => item === null ? { '@_xsi:nil': 'true' } : item)); // Need to check for null, because undefined gets converted to null when JSON is stringified
    // 2. For some reason, if your character knows only 1 crafting or cooking recipe, it will be an object, not an array (we probably don't need to undo this)
    players.forEach((player) => {
        for (const recipe of [player.craftingRecipes, player.cookingRecipes]) {
            if (recipe?.item && !Array.isArray(recipe.item)) {
                recipe.item = [recipe.item];
            }
        }
    });

    // Copy name to Name, and stack to Stack for every item in the inventory
    players.forEach((player) => [player.pantsItem, player.shirtItem, player.boots, player.leftRing, player.rightRing, ...player.items.Item].forEach((item) => {
        if (item) {
            // @ts-expect-error
            item.Name = item.name;
            // @ts-expect-error
            item.Stack = item.stack;
            // @ts-expect-error
            item.Stackable = item.stackable;
        }
    }));

    const builder = new XMLBuilder({ attributeNamePrefix: '@_', ignoreAttributes: false, suppressUnpairedNode: false, suppressEmptyNode: true, suppressBooleanAttributes: false });
    const raw = builder.build(json) as string;
    const xml = raw
        .split('------WebKitFormBoundary')[0]
        .trim()
        .replaceAll('&apos;', '\'')
        .replaceAll('/>', ' />');
    const blob = new Blob([xml], { type: 'text/text' });

    return new Response(blob);
};