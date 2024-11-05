import { browser } from "$app/environment";
import type { Player, Save } from "$types/save/1.6";
import { error, json } from "@sveltejs/kit";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

class SaveClass {
    private i = $state(0);
    public saveData = $state<Save>();
    public player = $derived(this.players?.[this.i]);
    public inventory = $derived(this.player?.items.Item);

    public nextFarmer() {
        this.i = (this.i + 1) % this.players.length;
    }

    public prevFarmer() {
        this.i = (this.i - 1 + this.players.length) % this.players.length;
    }

    public async import(file: File) {
        if (!file) {
            throw new Error("No file provided");
        }

        const xml = await file.text();

        const parser = new XMLParser({
            ignoreAttributes: false,
            allowBooleanAttributes: true,
        });
        const json = parser.parse(xml) as unknown;
        if (!isSaveFile(json)) error(400, "Invalid save file");

        const gameVersion = json.SaveGame.gameVersion as string | undefined;
        if (!["1.6"].some((v) => gameVersion?.startsWith(v)))
            throw new Error(`Unsupported game version: ${gameVersion}`);

        this.saveData = json.SaveGame;

        // Type safety enhancements
        for (const player of this.players) {
            // 1. Inventory, switch <string xsi:nil="true" /> into undefined
            // Need to check for null, because undefined gets converted to null when JSON is stringified
            player.items.Item = player.items.Item.map((item) =>
                !item || "xsi:nil" in item || "@_xsi:nil" in item
                    ? undefined
                    : item,
            );

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
    }

    public async export() {
        if (!this.saveData) throw new Error("No file provided");

        if (!("gameVersion" in this.saveData))
            throw new Error("Not valid save file");

        // Undo type safety enhancements
        // 1. Inventory, switch undefined into <string xsi:nil="true" /> (for farmhands, too) (flags too)
        // To be honest this is all kind of a hack. Realistically, we need something to parse through each node and convert
        // undefined to the appropriate xsi:nil attribute, but I couldn't find such a feature in fast-xml-parser
        for (const player of this.players) {
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
                item && "which" in item
                    ? { ...item, which: { "@_xsi:nil": "true" } }
                    : item,
            );
            // 2. For some reason, if your character knows only 1 crafting or cooking recipe, it will be an object, not an array (we probably don't need to undo this)
            for (const recipe of [
                player.craftingRecipes,
                player.cookingRecipes,
            ]) {
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

        const builder = new XMLBuilder({
            attributeNamePrefix: "@_",
            ignoreAttributes: false,
            suppressUnpairedNode: false,
            suppressEmptyNode: true,
            suppressBooleanAttributes: false,
        });
        const raw = builder.build({ SaveGame: this.saveData }) as string;
        const xml = raw
            .split("------WebKitFormBoundary")[0]
            ?.trim()
            .replaceAll("&apos;", "'")
            .replaceAll("/>", " />");
        if (!xml) throw new Error("Failed to generate XML");
        const blob = new Blob([xml], { type: "text/text" });

        return blob;
    }

    public async download(filename: string) {
        if (!this.saveData) throw new Error("No file provided");

        const blob = await this.export();

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
    }

    get players() {
        if (!this.saveData) return [];
        const farmers =
            this.saveData.farmhands.Farmer === undefined
                ? []
                : Array.isArray(this.saveData.farmhands.Farmer)
                    ? this.saveData.farmhands.Farmer
                    : [this.saveData.farmhands.Farmer];
        const mainPlayer = this.saveData.player;

        return [mainPlayer, ...farmers];
    }

    set players(players: Player[]) {
        if (!this.saveData) return;
        if (!players[0]) throw new Error("Main player is required");

        this.saveData.player = players[0];
        this.saveData.farmhands.Farmer = players.slice(1);
    }

    get farm() {
        return this.saveData?.locations.GameLocation.find(
            (l) => l.name === "Farm",
        );
    }
}

const isSaveFile = (obj: unknown): obj is SaveFile => {
    return (
        typeof obj === "object" &&
        obj !== null &&
        "SaveGame" in obj &&
        typeof obj.SaveGame === "object" &&
        obj.SaveGame !== null
    );
};

export const saveManager = new SaveClass();
