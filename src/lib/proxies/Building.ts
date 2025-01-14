import type { Farmer } from "$lib/proxies/Farmer";
import { GameLocation } from "$lib/proxies/GameLocation";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { Building as BuildingType } from "$types/save";
import buildings from "$generated/buildings.json";

export class Building {
    raw: BuildingType;
    #context: SaveProxy;

    constructor(building: BuildingType, context: SaveProxy) {
        this.raw = building;
        this.#context = context;
    }

    get data() {
        return buildings.find((b) => b.name === this.raw.buildingType);
    }

    get location() {
        return (
            this.raw.indoors &&
            new GameLocation(this.raw.indoors, this.#context)
        );
    }

    set location(value) {
        this.raw.indoors = value?.raw;
    }

    get name() {
        return this.raw.buildingType;
    }

    // set name(value) {
    //     // @ts-expect-error
    //     this.raw.nonInstancedIndoorsName = !value ? nil : value;
    // }

    get upgradeLevel() {
        if (!["Farmhouse", "Cabin"].includes(this.raw.buildingType))
            return undefined;

        /*
            This one is a bit of a mess... So the "main" "Farmhouse":
                <GameLocation xsi:type="Farmhouse">
            Has its own GameLocation, meanwhile the other "Farmhouse" buildings are just buildings inside Farm, with a small wrapper for metadata:
                <GameLocation xsi:type="Farm">
                    <buildings>
                        <Building>
                            <id>3823767c-4cd5-4547-9237-d491c75b1de8</id>
                            <skinId>
                                <string>Stone Cabin</string>
                            </skinId>
                            <indoors xsi:type="Cabin">
                                <farmhandReference>6068609879082890065</farmhandReference>
            
            Each "cabin" has a farmhandReference, which corresponds to the uniqueMultiplayerID of the player that owns it.

            Note that the "main" Farmhouse doesn't have a farmhandReference, it just goes to the main player on the save file, regardless of uniqueMultiplayerID.

            From there, we can assume which player owns the building, then change the upgrade level accordingly.
        */
        const playerId = this.raw.indoors?.farmhandReference;
        const player = !playerId
            ? this.#context.players[0]
            : this.#context.players.find((p) => p.uniqueID === playerId);
        if (!player) throw new Error("Player not found");

        return player.raw.houseUpgradeLevel;
    }

    set upgradeLevel(value) {
        if (value === undefined) throw new Error("Value cannot be undefined");
        if (!["Farmhouse", "Cabin"].includes(this.raw.buildingType))
            throw new Error("Building type not supported");

        const playerId = this.raw.indoors?.farmhandReference;
        const player = !playerId
            ? this.#context.players[0]
            : this.#context.players.find((p) => p.uniqueID === playerId);
        if (!player) throw new Error("Player not found");

        player.raw.houseUpgradeLevel = value;
    }

    get homeOf() {
        if (!this.raw.indoors) return undefined;
        if (!["Farmhouse", "Cabin"].includes(this.raw.buildingType))
            return undefined;

        return this.#context.players.filter(
            (p) => p && p.raw.homeLocation === this.raw.indoors?.uniqueName,
        ) as Farmer[];
    }

    set homeOf(value) {
        if (!value) throw new Error("Value cannot be undefined");
        if (!["Farmhouse", "Cabin"].includes(this.raw.buildingType))
            throw new Error("Building type not supported");
        if (!this.raw.indoors) throw new Error("Building has no indoors");
        if (!this.raw.indoors.uniqueName)
            throw new Error("Building has no uniqueName");

        for (const player of value) {
            player.raw.homeLocation = this.raw.indoors.uniqueName;
        }
    }

    // This needs to be typed for some reason
    get repaired(): boolean | undefined {
        if (this.raw.buildingType !== "Greenhouse") return undefined;

        const farm = this.#context.farm;
        return farm?.raw.greenhouseUnlocked;
    }

    set repaired(value) {
        if (this.raw.buildingType !== "Greenhouse")
            throw new Error("Building type not supported");
        if (value === undefined) throw new Error("Value cannot be undefined");

        const farm = this.#context.farm;
        if (!farm) throw new Error("Farm not found");

        farm.raw.greenhouseUnlocked = value;
    }
}
