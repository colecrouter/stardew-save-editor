import { CommunityBundles } from "$lib/proxies/CommunityBundles";
import { Farmer } from "$lib/proxies/Farmer";
import { GameLocation } from "$lib/proxies/GameLocation";

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

    get players() {
        if (!this.raw) return [];
        const unfiltered =
            this.raw.SaveGame.farmhands === ""
                ? []
                : this.raw.SaveGame.farmhands.Farmer;
        const farmers = unfiltered.filter((f) => f !== undefined);
        const mainPlayer = this.raw.SaveGame.player;

        return [mainPlayer, ...farmers].map((f) => new Farmer(f));
    }

    set players(players) {
        if (!this.raw) return;
        if (!players[0]) throw new Error("Main player is required");

        const someTyped = <T>(arr: (T | undefined)[]): arr is T[] =>
            arr.some((a) => a !== undefined);

        const mainPlayer = players[0]?.raw;
        const farmhands = players.slice(1).map((f) => f?.raw);

        if (mainPlayer === undefined)
            throw new Error("Main player is required");
        if (farmhands.length && someTyped(farmhands) === false)
            throw new Error("Farmhands are required");

        this.raw.SaveGame.player = mainPlayer;
        if (this.raw.SaveGame.farmhands === "") {
            this.raw.SaveGame.farmhands = { Farmer: farmhands };
        } else {
            this.raw.SaveGame.farmhands.Farmer = farmhands;
        }
    }

    get farm() {
        if (!this.raw) return undefined;
        const farm = this.raw?.SaveGame.locations.GameLocation.find(
            (l) => l.name === "Farm",
        );
        if (!farm) throw new Error("Farm not found");

        return new GameLocation(farm);
    }

    set farm(farm) {
        if (!this.raw) return;
        if (!farm) throw new Error("Farm is required");

        const index = this.raw.SaveGame.locations.GameLocation.findIndex(
            (l) => l.name === "Farm",
        );
        this.raw.SaveGame.locations.GameLocation[index] = farm.raw;
    }

    get locations() {
        if (!this.raw) return [];
        return this.raw.SaveGame.locations.GameLocation.map(
            (l) => new GameLocation(l),
        );
    }

    set locations(locations) {
        if (!this.raw) return;
        if (!locations.length) throw new Error("Locations are required");

        this.raw.SaveGame.locations.GameLocation = locations.map((l) => l.raw);
    }

    get goldenWalnuts() {
        if (!this.raw) return 0;
        return this.raw.SaveGame.goldenWalnuts ?? 0;
    }

    set goldenWalnuts(value) {
        if (!this.raw) return;
        this.raw.SaveGame.goldenWalnuts = value ?? 0;
    }

    get deepestMineLevel() {
        if (!this.raw) return 0;
        return this.raw.SaveGame.player.deepestMineLevel ?? 0;
    }

    set deepestMineLevel(value) {
        if (!this.raw) return;
        this.raw.SaveGame.player.deepestMineLevel = value ?? 0;
    }

    get communityBundles() {
        if (!this.raw) return undefined;
        const location = this.locations.find(
            (l) => l.raw.name === "CommunityCenter",
        );
        if (!location) throw new Error("CommunityCenter not found");

        return new CommunityBundles(location, this.raw.SaveGame.bundleData);
    }
}
