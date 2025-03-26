import { CCRoom, bundleSideEffects } from "$lib/bundleSideEffects";
import type { GameLocation } from "$lib/proxies/GameLocation";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type {
    BoolArrayContainer,
    BoolContainer,
    BundleData,
    StringContainer,
} from "$types/save";

/*
    > Key: "Pantry/2"

    - [0] Room ID - "Pantry", "Crafts Room", "Fish Tank", "Boiler Room", "Vault", "Bulletin Board"
    - [1] Sprite index in LooseSprites/JunimoNote spritesheet

    > Value: "Fall Crops/BO 10 1/270 1 0 272 1 0 276 1 0 280 1 0/2/4/2/Fall Crops"

    - [0] Bundle name - Internal name, do not change
    - [1] Reward item - <item type> <item ID> <quantity>
    - [2] Requirements - [<item ID> <quantity> <min quality>]...
    - [3] Color - [incomplete, complete] (same as key[1]??)
        -> 0 = green, green
        -> 1 = purple, purple
        -> 2 = orange, orange
        -> 3 = yellow, pink
        -> 4 = red, flower(?)
        -> 5 = blue, blue
        -> 6 = teal, teal
    - [4] Required item count - How many items are required to complete the bundle (up to 12)
    - [5] Translated display name
*/

export enum BundleName {
    SpringCrops = 0,
    SummerCrops = 1,
    FallCrops = 2,
    QualityCrops = 3,
    Animal = 4,
    Artisan = 5,
    RiverFish = 6,
    LakeFish = 7,
    OceanFish = 8,
    NightFish = 9,
    SpecialtyFish = 10,
    CrabPot = 11,
    SpringForaging = 13,
    SummerForaging = 14,
    FallForaging = 15,
    WinterForaging = 16,
    Construction = 17,
    ExoticForaging = 19,
    Blacksmith = 20,
    Geologist = 21,
    Adventurer = 22,
    Chef = 31,
    FieldResearch = 32,
    Enchanter = 33,
    Dye = 34,
    Fodder = 35,
    Vault = 36,
}

export class CommunityBundles {
    private communityCenter: GameLocation;
    private bundleData: BundleData;

    constructor(location: GameLocation, bundleData: BundleData) {
        if (location.raw?.bundles === undefined)
            throw new Error("Invalid CommunityBundles location");

        this.communityCenter = location;
        this.bundleData = bundleData;
    }

    get bundles() {
        if (!this.communityCenter.raw.bundles)
            throw new Error("Invalid CommunityBundles location");

        return this.communityCenter.raw.bundles.item.map((bundle, i) => {
            if (!this.bundleData.item[i])
                throw new Error("Invalid bundle data");

            const submitted = bundle.value;

            return new Bundle(
                this.bundleData.item[i].value,
                this.bundleData.item[i].key,
                bundle.value.ArrayOfBoolean,
            );
        });
    }

    /**
     * Takes the existing bundle completion data, applies the appropriate changes.
     * Toggles "completeness" of CC rooms whose bundles are no longer completed.
     * Gives the appropriate world changes, e.g. unlocking the bus stop.
     *
     * @param save The save file to apply side effects to. The save file isn't passed into the constructor to avoid unnecessary reactivity.
     */
    applySideEffects(save: SaveProxy) {
        // Get all bundles, group by room
        const bundlesByRoom = Map.groupBy(this.bundles, (b) => b.room);

        // Figure out which rooms are completed
        const completedRooms = [...bundlesByRoom.entries()].map(
            ([room, bundles]) =>
                [room, bundles.every((b) => b.completed)] as const,
        );

        // Apply side effects
        for (const [room, completed] of completedRooms) {
            const pair = bundleSideEffects.get(room);
            if (!pair) continue;

            if (completed) {
                // Apply side effect
                pair.add(save, this.communityCenter);
                console.debug(`Applied side effect for room ${CCRoom[room]}`);
            } else {
                // Remove side effect
                pair.remove(save, this.communityCenter);
                console.debug(`Removed side effect for room ${CCRoom[room]}`);
            }
        }

        // Apply side effect if all rooms are completed
        if (completedRooms.every(([, completed]) => completed)) {
            const pair = bundleSideEffects.get(null);
            if (pair) {
                pair.add(save, this.communityCenter);
                console.debug("Applied side effect for completed CC");
            }
        } else {
            const pair = bundleSideEffects.get(null);
            if (pair) {
                pair.remove(save, this.communityCenter);
                console.debug("Removed side effect for completed CC");
            }
        }
    }
}

export class Bundle {
    private bundleData: StringContainer;
    private bundleKey: StringContainer;
    private submit: BoolArrayContainer;

    constructor(
        bundleData: StringContainer,
        bundleKey: StringContainer,
        submitted: BoolArrayContainer,
    ) {
        this.bundleData = bundleData;
        this.bundleKey = bundleKey;
        this.submit = submitted;
    }

    get name() {
        const { name } = parseValue(this.bundleData.string);
        return name;
    }

    set name(value) {
        const { reward, requirements, color, count, displayName } = parseValue(
            this.bundleData.string,
        );
        this.bundleData.string = updateValue({
            name: value,
            reward,
            requirements,
            color,
            count,
            displayName,
        });
    }

    get id() {
        return parseKey(this.bundleKey.string).spriteIndex;
    }

    set id(value) {
        const { roomName, room } = parseKey(this.bundleKey.string);
        this.bundleKey.string = updateKey({
            roomName,
            room,
            spriteIndex: value,
        });
    }

    get completed() {
        const submitted = this.submit.boolean.reduce(
            (a, b) => (b ? a + 1 : a),
            0,
        );
        const { count: required, requirements } = parseValue(
            this.bundleData.string,
        );

        return submitted >= (required ?? requirements.length);
    }

    get requiredItems() {
        const { requirements } = parseValue(this.bundleData.string);

        return requirements.map((_, i) => {
            return new BundleRequiredItem(this.submit, this.bundleData, i);
        });
    }

    get color() {
        return parseValue(this.bundleData.string).color;
    }

    get reward() {
        const { reward } = parseValue(this.bundleData.string);
        if (!reward) return null;

        return new BundleReward(this.bundleData);
    }

    get room() {
        return parseKey(this.bundleKey.string).room;
    }

    get requiredItemCount() {
        return (
            parseValue(this.bundleData.string).count ??
            this.requiredItems.length
        );
    }
}

export class BundleRequiredItem {
    private submit: BoolArrayContainer;
    private bundleData: StringContainer;
    private index: number;

    constructor(
        submitted: BoolArrayContainer,
        bundleData: StringContainer,
        index: number,
    ) {
        this.submit = submitted;
        this.bundleData = bundleData;
        this.index = index;
    }

    private parseRequirements() {
        const { requirements } = parseValue(this.bundleData.string);

        const item = requirements[this.index];
        if (!item) throw new Error("Invalid bundle data");

        return item;
    }

    private updateRequirements(
        itemID: string,
        quantity: number,
        quality: number,
    ) {
        const { name, reward, requirements, color, count, displayName } =
            parseValue(this.bundleData.string);

        requirements[this.index] = [itemID, quantity, quality];
        this.bundleData.string = updateValue({
            name,
            reward,
            requirements,
            color,
            count,
            displayName,
        });
    }

    get itemID() {
        return Number.parseInt(this.parseRequirements()[0]);
    }

    set itemID(value) {
        const [, quantity, quality] = this.parseRequirements();
        this.updateRequirements(value.toString(), quantity, quality);
    }

    get quantity() {
        return this.parseRequirements()[1];
    }

    set quantity(value) {
        const [itemID, , quality] = this.parseRequirements();
        this.updateRequirements(itemID, value, quality);
    }

    get quality() {
        return this.parseRequirements()[2];
    }

    set quality(value) {
        const [itemID, quantity] = this.parseRequirements();
        this.updateRequirements(itemID, quantity, value);
    }

    get submitted() {
        return this.submit.boolean[this.index] ?? false;
    }

    set submitted(value) {
        this.submit.boolean[this.index] = value;
    }
}

export class BundleReward {
    private bundleData: StringContainer;

    constructor(bundleData: StringContainer) {
        this.bundleData = bundleData;
    }

    private parseReward() {
        const [, reward] = this.bundleData.string.split("/");
        if (!reward) throw new Error("Invalid bundle data");

        const [type, itemID, quantity] = reward.split(" ");
        if (!type || !itemID || !quantity)
            throw new Error("Invalid bundle data");

        return [type, itemID, Number.parseInt(quantity)] as const;
    }

    private updateReward(type: string, itemID: string, quantity: number) {
        const [name, , requirements, ...rest] =
            this.bundleData.string.split("/");
        if (!requirements) throw new Error("Invalid bundle data");

        this.bundleData.string = `${name}/${type} ${itemID} ${quantity}/${requirements}/${rest.join(
            "/",
        )}`;
    }

    get type() {
        return this.parseReward()[0] as "O" | "BO";
    }

    set type(value) {
        const [, itemID, quantity] = this.parseReward();
        this.updateReward(value, itemID, quantity);
    }

    get itemID() {
        return Number.parseInt(this.parseReward()[1]);
    }

    set itemID(value) {
        const [type, , quantity] = this.parseReward();
        this.updateReward(type, value.toString(), quantity);
    }

    get quantity() {
        return this.parseReward()[2];
    }

    set quantity(value) {
        const [type, itemID] = this.parseReward();
        this.updateReward(type, itemID, value);
    }
}

const parseValue = (s: string) => {
    const [name, reward, requirements, color, count, displayName] =
        s.split("/");
    if (!requirements) throw new Error("Invalid bundle data");

    // Weird formatting sometimes
    const splitRequirements = requirements.replaceAll(/\s+/g, " ").split(" ");
    const items: [string, number, number][] = [];
    for (let i = 0; i < splitRequirements.length; i += 3) {
        const [itemID, quantity, quality] = splitRequirements.slice(i, i + 3);
        if (!itemID || !quantity || !quality)
            throw new Error("Invalid requirement data");

        items.push([
            itemID,
            Number.parseInt(quantity),
            Number.parseInt(quality),
        ]);
    }

    if (!color) throw new Error("Invalid color for bundle data");

    return {
        name,
        reward,
        requirements: items,
        color: color ? Number.parseInt(color) : undefined,
        count: count ? Number.parseInt(count) : undefined,
        displayName,
    };
};

const parseKey = (s: string) => {
    const [roomName, spriteIndex] = s.split("/");

    if (!roomName || !spriteIndex) throw new Error("Invalid bundle key");

    let room: CCRoom;
    switch (roomName) {
        case "Pantry":
            room = CCRoom.Pantry;
            break;
        case "Crafts Room":
            room = CCRoom.CraftsRoom;
            break;
        case "Fish Tank":
            room = CCRoom.FishTank;
            break;
        case "Boiler Room":
            room = CCRoom.BoilerRoom;
            break;
        case "Vault":
            room = CCRoom.Vault;
            break;
        case "Bulletin Board":
            room = CCRoom.BulletinBoard;
            break;
        case "Abandoned Joja Mart":
            room = CCRoom.AbandonedJojaMart;
            break;
        default:
            throw new Error(`Invalid room name: ${roomName}`);
    }

    return { room, roomName, spriteIndex: Number.parseInt(spriteIndex) };
};

const updateValue = (o: ReturnType<typeof parseValue>) => {
    const { name, reward, requirements, color, count, displayName } = o;
    return `${name}/${reward}/${requirements
        .map(([itemID, quantity, quality]) => `${itemID}${quantity}${quality}`)
        .join("")}/${color}/${count}/${displayName}`;
};

const updateKey = (o: ReturnType<typeof parseKey>) => {
    const { roomName, spriteIndex } = o;
    return `${roomName}/${spriteIndex}`;
};
