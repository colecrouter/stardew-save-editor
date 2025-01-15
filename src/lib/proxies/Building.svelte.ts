import buildings from "$generated/buildings.json";
import type { Farmer } from "$lib/proxies/Farmer";
import { GameLocation } from "$lib/proxies/GameLocation";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { Coordinates } from "$types/items";
import type { Building as BuildingType, Item, TileLocation } from "$types/save";

/** Move the in-game-location position of the item, assuming it's placed */
function movePosition(item: Item, pos: Coordinates) {
    if (!item.tileLocation) throw new Error("Item is not placed");

    item.tileLocation = {
        X: pos.x,
        Y: pos.y,
    };

    if (item.boundingBox) {
        item.boundingBox.Location = {
            X: pos.x * 64,
            Y: pos.y * 64,
        };
    }

    if (item.defaultBoundingBox) {
        item.defaultBoundingBox.Location = {
            X: pos.x * 64,
            Y: pos.y * 64,
        };
    }
}

class Transform {
    private translation: Coordinates;

    constructor(translation: Coordinates) {
        this.translation = translation;
    }

    apply(point: Coordinates) {
        return {
            x: point.x + this.translation.x,
            y: point.y + this.translation.y,
        };
    }

    private reverse() {
        return new Transform({
            x: -this.translation.x,
            y: -this.translation.y,
        });
    }

    private static readonly cabinTransforms = [
        undefined,
        new Transform({ x: 11, y: 0 }),
        new Transform({ x: 11, y: 0 }),
        new Transform({ x: 11, y: 0 }),
    ];

    static getTransforms(newLevel: number, oldLevel: number) {
        const transforms = new Array<Transform>();
        // If newLevel is greated than old level
        for (let i = oldLevel; i <= newLevel; i++) {
            const level = Transform.cabinTransforms[i];
            if (!level) continue;
            transforms.push(level);
        }
        // If newLevel is less than old level
        for (let i = oldLevel; i > newLevel; i--) {
            const level = Transform.cabinTransforms[i]?.reverse();
            if (!level) continue;
            transforms.push(level);
        }

        return transforms;
    }
}

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

    get indoorLocation() {
        if (this.raw.buildingType === "Farmhouse") {
            // This building is weird(?) It doesn't contain their own location, unlike farm buildings.
            // Need to find the matching GameLocation in the context
            return this.#context.locations.find(
                (l) => l.raw.name === "FarmHouse",
            );
        }
        return (
            this.raw.indoors &&
            new GameLocation(this.raw.indoors, this.#context)
        );
    }

    set indoorLocation(value) {
        if (this.raw.buildingType === "FarmHouse") {
            if (!value) throw new Error("Value cannot be undefined");

            const index = this.#context.locations.findIndex(
                (l) => l.raw.name === "FarmHouse",
            );
            this.#context.locations[index] = new GameLocation(
                value.raw,
                this.#context,
            );
            return;
        }

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

    set upgradeLevel(newLevel) {
        if (newLevel === undefined)
            throw new Error("Value cannot be undefined");
        if (!["Farmhouse", "Cabin"].includes(this.raw.buildingType))
            throw new Error("Building type not supported");

        const playerId = this.raw.indoors?.farmhandReference;
        const player = !playerId
            ? this.#context.players[0]
            : this.#context.players.find((p) => p.uniqueID === playerId);
        if (!player) throw new Error("Player not found");

        const oldLevel = player.raw.houseUpgradeLevel;
        player.raw.houseUpgradeLevel = newLevel;

        // Adjust all items in the location to fit the new building size
        const transforms = Transform.getTransforms(newLevel, oldLevel);

        // It's easier to iterate over the raw data than use the constructed 2D array
        // TODO maybe an easier abstraction is needed? I never thought about the use case
        const transformKV = (transforms: Transform[], loc: TileLocation) => {
            const oldVec = loc;
            const oldPos = { x: oldVec.X, y: oldVec.Y };
            const newPos = transforms.reduce(
                (pos, transform) => transform.apply(pos),
                oldPos,
            );

            // This needs to be returned as a new object, or else the proxy seems to overwrite the with original values
            return newPos;
        };

        const items = this.indoorLocation?.raw.objects?.item;
        if (items) {
            for (const item of items) {
                const newLoc = transformKV(transforms, item.key.Vector2);
                movePosition(item.value.Object, newLoc);
            }
        }

        const animals =
            this.indoorLocation?.raw.Animals
                .SerializableDictionaryOfInt64FarmAnimal?.item;

        if (animals) {
            for (const animal of animals) {
                const newLoc = transformKV(
                    transforms,
                    animal.value.FarmAnimal.Position,
                );
                animal.value.FarmAnimal.Position = {
                    X: newLoc.x,
                    Y: newLoc.y,
                };
            }
        }

        const furniture = this.indoorLocation?.raw.furniture?.Furniture;
        console.log(
            "Before furniture:",
            furniture?.map((f) => [f.name, f.tileLocation]),
        );
        if (furniture) {
            for (const item of furniture) {
                if (!item.tileLocation) continue;
                const newLoc = transformKV(transforms, item.tileLocation);
                movePosition(item, newLoc);
            }
        }
        console.log(
            "After furniture:",
            furniture?.map((f) => [f.name, f.tileLocation]),
        );

        const players = this.#context.players.filter(
            (p) => p && p.raw.homeLocation === this.raw.indoors?.uniqueName,
        );
        for (const player of players) {
            // transformKV(transforms, player.raw.Position);
        }

        this.indoorLocation = new GameLocation(
            this.raw.indoors!,
            this.#context,
        );

        console.log(this.indoorLocation);
    }

    get farmUpgradeLevel() {
        return this.raw.buildingType;
    }

    set farmUpgradeLevel(value) {
        if (!this.farmBuildingUpgrades.includes(value))
            throw new Error("Building cannot be upgraded to this type");

        // const currentBuiling = this.data;
        const newBuilding = buildings.find((b) => b.name === value);
        if (!newBuilding) throw new Error("Building not found");

        if (
            newBuilding.maxOccupants <
            (this.indoorLocation?.animals?.length ?? 0)
        )
            throw new Error("Not enough space current for animals");

        this.raw.buildingType = value;
        this.raw.maxOccupants = newBuilding.maxOccupants;
        this.raw.tilesWide = newBuilding.size.X;
        this.raw.tilesHigh = newBuilding.size.Y;
        this.raw.hayCapacity = newBuilding.hayCapacity;
        this.raw.animalDoor = newBuilding.animalDoor;
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
