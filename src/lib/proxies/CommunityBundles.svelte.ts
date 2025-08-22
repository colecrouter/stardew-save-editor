import { CCRoom, bundleSideEffects } from "$lib/bundleSideEffects";
import type { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type {
	BoolArrayContainer,
	BoolContainer,
	BundleData,
	StringContainer,
} from "$types/save";
import { type DataProxy, Raw } from ".";
import { MailFlag } from "./mail";

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
	public bundles: Bundle[]; // reactive collection of bundle proxies

	constructor(location: GameLocation, bundleData: BundleData) {
		if (location[Raw]?.bundles === undefined)
			throw new Error("Invalid CommunityBundles location");

		this.communityCenter = location;
		this.bundleData = bundleData;

		// Initialize bundle proxies from raw state
		this.bundles = $state(this.getBundles());
		$effect(() => this.setBundles(this.bundles));
	}

	// Build bundle proxy list from raw save data
	private getBundles(): Bundle[] {
		if (!this.communityCenter[Raw].bundles)
			throw new Error("Invalid CommunityBundles location");

		return this.communityCenter[Raw].bundles.item.map((bundle) => {
			const bundleKey = bundle.key.int;
			const matchingBundleData = this.bundleData.item.find((data) => {
				const { spriteIndex } = parseKey(data.key.string);
				return spriteIndex === bundleKey;
			});
			if (!matchingBundleData)
				throw new Error(`No bundle data found for bundle key ${bundleKey}`);
			return new Bundle(
				matchingBundleData.value,
				matchingBundleData.key,
				bundle.value.ArrayOfBoolean,
			);
		});
	}

	private setBundles(value: Bundle[]) {
		this.communityCenter[Raw].bundles = {
			item: value.map((b) => b.toRaw()),
		};
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
		const bundlesByRoom = Map.groupBy(this.bundles, (b: Bundle) => b.room);

		// Figure out which rooms are completed
		const completedRooms = [...bundlesByRoom.entries()].map(
			([room, bundles]) =>
				[room, bundles.every((b: Bundle) => b.completed)] as const,
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

		if (
			// If the user has Joja member, abandoned Joja Mart and Bulletin Board are not required (aka they can't be completed)
			save.player.mailReceived.has(MailFlag.JojaMember)
				? completedRooms
						.filter(
							([r]) =>
								![CCRoom.AbandonedJojaMart, CCRoom.BulletinBoard].includes(r),
						)
						.every(([, completed]) => completed)
				: completedRooms.every(([, completed]) => completed)
		) {
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

	public name: string; // internal name
	public id: number; // sprite index
	public requiredItems: BundleRequiredItem[];
	public completed: boolean;
	public color: number | undefined;
	public reward: BundleReward | null;
	public room: CCRoom;
	public requiredItemCount: number;

	// Internal reward cache to avoid recreating proxy unnecessarily
	private _rewardCache: BundleReward | null = null;

	constructor(
		bundleData: StringContainer,
		bundleKey: StringContainer,
		submitted: BoolArrayContainer,
	) {
		this.bundleData = bundleData;
		this.bundleKey = bundleKey;
		this.submit = submitted;

		// Initialize reactive fields
		this.name = $state(parseValue(this.bundleData.string).name ?? "");
		$effect(() => this.writeName(this.name));

		this.id = $state(parseKey(this.bundleKey.string).spriteIndex);
		$effect(() => this.writeId(this.id));

		// Room (constant unless key room portion changes externally)
		this.room = parseKey(this.bundleKey.string).room;

		// Required items proxies
		const { requirements, reward, color, count } = parseValue(
			this.bundleData.string,
		);
		this.requiredItems = $state(
			requirements.map(
				(_, i) => new BundleRequiredItem(this.submit, this.bundleData, i),
			),
		);

		// Derived values using $derived.by
		this.color = $derived.by(() => this.parse().color);
		this.requiredItemCount = $derived.by(
			() => this.parse().count ?? this.requiredItems.length,
		);
		this.reward = $derived.by(() => this.rewardProxy());
		this.completed = $derived.by(() => {
			const { count } = this.parse();
			const needed = count ?? this.requiredItems.length;
			let submitted = 0;
			for (const item of this.requiredItems) if (item.submitted) submitted++;
			return submitted >= needed;
		});
	}

	// --- Private helpers mirroring pattern used in GameLocation ---
	private parse() {
		return parseValue(this.bundleData.string);
	}
	private writeName(value: string) {
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

	private writeId(value: number) {
		const { roomName, room } = parseKey(this.bundleKey.string);
		this.bundleKey.string = updateKey({ roomName, room, spriteIndex: value });
	}

	private rewardProxy() {
		const hasReward = this.parse().reward;
		if (!hasReward) {
			this._rewardCache = null;
			return null;
		}
		if (!this._rewardCache)
			this._rewardCache = new BundleReward(this.bundleData);
		return this._rewardCache;
	}

	// Expose raw submission data for syncing back to GameLocation
	public toRaw() {
		const { spriteIndex } = parseKey(this.bundleKey.string);
		return {
			key: { int: spriteIndex },
			value: { ArrayOfBoolean: this.submit },
		};
	}
}

export class BundleRequiredItem {
	private submit: BoolArrayContainer;
	private bundleData: StringContainer;
	private index: number;

	// Reactive fields
	public itemID: number;
	public quantity: number;
	public quality: number;
	public submitted: boolean;

	constructor(
		submitted: BoolArrayContainer,
		bundleData: StringContainer,
		index: number,
	) {
		this.submit = submitted;
		this.bundleData = bundleData;
		this.index = index;

		// Initialize reactive fields from current requirement entry
		const req = this.parseRequirements();
		this.itemID = $state(Number.parseInt(req[0]));
		this.quantity = $state(req[1]);
		this.quality = $state(req[2]);
		this.submitted = $state(this.submit.boolean[this.index] ?? false);

		// Single effect to write back requirement updates

		$effect(() => this.writeRequirement());
		$effect(() => this.writeSubmitted());
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

	private writeRequirement() {
		this.updateRequirements(
			this.itemID.toString(),
			this.quantity,
			this.quality,
		);
	}

	private writeSubmitted() {
		this.submit.boolean[this.index] = this.submitted;
	}
}

export class BundleReward {
	private bundleData: StringContainer;

	// Reactive reward components
	public type: "O" | "BO";
	public itemID: number;
	public quantity: number;

	constructor(bundleData: StringContainer) {
		this.bundleData = bundleData;

		const [type, itemID, quantity] = this.parseReward();
		this.type = $state(type as "O" | "BO");
		this.itemID = $state(Number.parseInt(itemID));
		this.quantity = $state(quantity);

		$effect(() => this.writeReward());
	}

	private parseReward() {
		const [, reward] = this.bundleData.string.split("/");
		if (!reward) throw new Error("Invalid bundle data");

		const [type, itemID, quantity] = reward.split(" ");
		if (!type || !itemID || !quantity) throw new Error("Invalid bundle data");

		return [type, itemID, Number.parseInt(quantity)] as const;
	}

	private updateReward(type: string, itemID: string, quantity: number) {
		const [name, , requirements, ...rest] = this.bundleData.string.split("/");
		if (!requirements) throw new Error("Invalid bundle data");

		this.bundleData.string = `${name}/${type} ${itemID} ${quantity}/${requirements}/${rest.join(
			"/",
		)}`;
	}

	private writeReward() {
		this.updateReward(this.type, this.itemID.toString(), this.quantity);
	}
}

const parseValue = (s: string) => {
	const [name, reward, requirements, color, count, displayName] = s.split("/");
	if (!requirements) throw new Error("Invalid bundle data");

	// Weird formatting sometimes
	const splitRequirements = requirements.replaceAll(/\s+/g, " ").split(" ");
	const items: [string, number, number][] = [];
	for (let i = 0; i < splitRequirements.length; i += 3) {
		const [itemID, quantity, quality] = splitRequirements.slice(i, i + 3);
		if (!itemID || !quantity || !quality)
			throw new Error("Invalid requirement data");

		items.push([itemID, Number.parseInt(quantity), Number.parseInt(quality)]);
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
