import type { Farmer } from "$lib/proxies/Farmer";
import { GameLocation } from "$lib/proxies/GameLocation";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { Building as BuildingType } from "$types/save";
import buildings from "$generated/buildings.json";

export class Building {
    raw: BuildingType;
    #context: SaveProxy;
    #name = $state<string>();

    constructor(building: BuildingType, context: SaveProxy) {
        this.raw = building;
        this.#context = context;
        this.#name = this.raw.buildingType;
    }

    get farmBuildingUpgrades() {
        // Each building in buildings.json has a "upgradedFrom" field, which is the name of the building it upgrades from.
        // This maps to a linked list of sorts, where each building has a reference to the building it upgrades from.

        let keyword = this.raw.buildingType.replace(/(?:Big|Deluxe)\s/, "");
        const upgrades = keyword
            ? [buildings.find((b) => b.name === keyword)?.name]
            : [];
        while (keyword) {
            const building = buildings.find((b) => b.upgradedFrom === keyword);
            if (!building) break;
            upgrades.push(building.name);
            keyword = building.name;
        }

        return upgrades;
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
        return this.#name;
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

    get farmUpgradeLevel() {
        return this.raw.buildingType;
    }

    set farmUpgradeLevel(value) {
        if (!this.farmBuildingUpgrades.includes(value))
            throw new Error("Building cannot be upgraded to this type");

        const newData = buildings.find((b) => b.name === value);
        if (!newData) throw new Error("Building not found");

        if (newData.maxOccupants < (this.location?.animals?.length ?? 0))
            throw new Error("Not enough space current for animals");

        this.raw.buildingType = value;
        this.raw.maxOccupants = newData.maxOccupants;
        this.raw.tilesWide = newData.size.X;
        this.raw.tilesHigh = newData.size.Y;
        this.raw.hayCapacity = newData.hayCapacity;
        this.raw.animalDoor = newData.animalDoor;
        this.#name = value;
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
