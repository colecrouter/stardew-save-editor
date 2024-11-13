import { Farmer } from "$lib/proxies/Farmer";
import type { GameLocation } from "$types/save/1.6";
import { XMLBuilder } from "fast-xml-parser";

export class SaveProxy {
    private i = $state(0);
    public raw = $state<SaveFile>();

    constructor(data: SaveFile) {
        const gameVersion = data.SaveGame.gameVersion as string | undefined;
        if (!["1.6"].some((v) => gameVersion?.startsWith(v)))
            throw new Error(`Unsupported game version: ${gameVersion}`);

        this.raw = data;
    }

    public get player() {
        const player = this.players[this.i];
        if (!player) throw new Error("No player found");
        return player;
    }

    public set player(player: Farmer) {
        if (!player) {
            delete this.players[this.i];
        } else {
            this.players[this.i] = player;
        }
    }

    public nextFarmer() {
        this.i = (this.i + 1) % this.players.length;
    }

    public prevFarmer() {
        this.i = (this.i - 1 + this.players.length) % this.players.length;
    }

    public async toXML() {
        if (!this.raw) throw new Error("No file provided");

        if (!("gameVersion" in this.raw.SaveGame))
            throw new Error("Not valid save file");

        const builder = new XMLBuilder({
            attributeNamePrefix: "@_",
            ignoreAttributes: false,
            suppressUnpairedNode: false,
            suppressEmptyNode: true,
            suppressBooleanAttributes: false,
        });
        const raw = builder.build({ SaveGame: this.raw }) as string;
        const xml = raw
            .split("------WebKitFormBoundary")[0]
            ?.trim()
            .replaceAll("&apos;", "'")
            .replaceAll("/>", " />");
        if (!xml) throw new Error("Failed to generate XML");
        const blob = new Blob([xml], { type: "text/text" });

        return blob;
    }

    get players() {
        if (!this.raw) return [];
        const farmers =
            this.raw.SaveGame.farmhands.Farmer === undefined
                ? []
                : Array.isArray(this.raw.SaveGame.farmhands.Farmer)
                  ? this.raw.SaveGame.farmhands.Farmer
                  : [this.raw.SaveGame.farmhands.Farmer];
        const mainPlayer = this.raw.SaveGame.player;

        return [mainPlayer, ...farmers].map((f) => new Farmer(f));
    }

    set players(players: Farmer[]) {
        if (!this.raw) return;
        if (!players[0]) throw new Error("Main player is required");

        const someTyped = <T>(arr: (T | undefined)[]): arr is T[] =>
            arr.some((a) => a !== undefined);

        const mainPlayer = players[0]?.raw;
        const farmhands = players.slice(1).map((f) => f?.raw);

        if (mainPlayer === undefined)
            throw new Error("Main player is required");
        if (someTyped(farmhands) === false)
            throw new Error("Farmhands are required");

        this.raw.SaveGame.player = mainPlayer;
        this.raw.SaveGame.farmhands.Farmer = farmhands;
    }

    get farm() {
        if (!this.raw) return undefined;
        const farm = this.raw?.SaveGame.locations.GameLocation.find(
            (l) => l.name === "Farm",
        );

        return farm;
    }

    set farm(farm: GameLocation | undefined) {
        if (!this.raw) return;
        if (!farm) throw new Error("Farm is required");

        const index = this.raw.SaveGame.locations.GameLocation.findIndex(
            (l) => l.name === "Farm",
        );
        this.raw.SaveGame.locations.GameLocation[index] = farm;
    }

    get goldenWalnuts() {
        if (!this.raw) return 0;
        return this.raw.SaveGame.goldenWalnuts ?? 0;
    }

    set goldenWalnuts(value) {
        if (!this.raw) return;
        this.raw.SaveGame.goldenWalnuts = value ?? 0;
    }
}
