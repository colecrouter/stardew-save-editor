import { CCRoom, bundleSideEffects } from "$lib/bundleSideEffects";
import type { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { GameLocation as GameLocationRaw } from "$types/save";
import type { BoolArrayContainer, StringContainer } from "$types/save";
import { SvelteMap } from "svelte/reactivity";
import { type DataProxy, Raw } from ".";
import { MailFlag } from "./Mail.svelte";
import {
	type BundleRequirement,
	parseBundleKey,
	parseBundleValue,
	replaceRequirement,
	serializeBundleKey,
	withBundleName,
	withBundleReward,
} from "./bundleSerialization";

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

/**
 * Represents the community bundles in the game, and their current completion status.
 */
export class CommunityBundles extends SvelteMap<BundleName, Bundle> {
	private communityCenter: GameLocation;
	private saveData: SaveProxy;

	constructor(saveData: SaveProxy) {
		const cc = saveData.locations.find(
			(l) => l[Raw].name === "CommunityCenter",
		);
		if (!cc) throw new Error("CommunityCenter location not found");

		if (cc[Raw]?.bundles === undefined)
			throw new Error("Invalid CommunityBundles location");

		const bundleData = saveData[Raw].SaveGame.bundleData;
		const bundles = cc[Raw].bundles.item.map((bundle) => {
			const bundleKey = bundle.key.int as BundleName;
			const matchingBundleData = bundleData.item.find((data) => {
				const { spriteIndex } = parseBundleKey(data.key.string);
				return spriteIndex === bundleKey;
			});
			if (!matchingBundleData)
				throw new Error(`No bundle data found for bundle key ${bundleKey}`);
			const b = new Bundle(
				matchingBundleData.value,
				matchingBundleData.key,
				bundle.value.ArrayOfBoolean,
			);
			return [bundleKey, b] as const;
		});

		super(bundles);

		this.communityCenter = cc;
		this.saveData = saveData;

		// Sanitize bundleRewards immediately on load
		this.sanitizeBundleRewards();

		// Apply proper save side effects
		$effect(() => this.applySideEffects());
	}

	/**
	 * Takes the existing bundle completion data, applies the appropriate changes.
	 * Toggles "completeness" of CC rooms whose bundles are no longer completed.
	 * Gives the appropriate world changes, e.g. unlocking the bus stop.
	 */
	private applySideEffects() {
		// Get all bundles, group by room
		const bundlesByRoom = Map.groupBy(this.values(), (b: Bundle) => b.room);

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
				pair.add(this.saveData, this.communityCenter);
				console.debug(`Applied side effect for room ${CCRoom[room]}`);
			} else {
				// Remove side effect
				pair.remove(this.saveData, this.communityCenter);
				console.debug(`Removed side effect for room ${CCRoom[room]}`);
			}
		}

		if (
			// If the user has Joja member, abandoned Joja Mart and Bulletin Board are not required (aka they can't be completed)
			this.saveData.player.mailReceived.has(MailFlag.JojaMember)
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
				pair.add(this.saveData, this.communityCenter);
				console.debug("Applied side effect for completed CC");
			}
		} else {
			const pair = bundleSideEffects.get(null);
			if (pair) {
				pair.remove(this.saveData, this.communityCenter);
				console.debug("Removed side effect for completed CC");
			}
		}

		// After applying any side effects, ensure bundleRewards remains valid/safe
		this.sanitizeBundleRewards();
	}

	/**
	 * Ensure Community Center bundleRewards only contains valid keys and that
	 * problematic entries are corrected. Specifically prevents key 36 from
	 * being set true, which can crash the game.
	 */
	private sanitizeBundleRewards() {
		const ccRaw = this.communityCenter[Raw] as GameLocationRaw;
		const bundles = ccRaw?.bundles?.item;
		const rewards = ccRaw?.bundleRewards;

		if (!rewards || !rewards.item || !bundles) return;

		const validKeys = new Set<number>(bundles.map((b) => b.key.int));

		// Drop any reward entries that don't correspond to an existing bundle key
		const beforeLen = rewards.item.length;
		rewards.item = rewards.item.filter((kv) => validKeys.has(kv.key.int));
		if (rewards.item.length !== beforeLen) {
			console.warn(
				`Removed ${beforeLen - rewards.item.length} invalid bundleRewards entries`,
			);
		}

		// Force key 36 to false as a safety measure
		for (const kv of rewards.item) {
			if (kv.key.int === 36 && kv.value.boolean === true) {
				kv.value.boolean = false;
				console.warn(
					"Corrected bundleRewards[36] from true to false to prevent a crash",
				);
			}
		}
	}
}

/**
 * Represents a single bundle from the Community Center
 */
export class Bundle {
	private bundleData: StringContainer;
	private bundleKey: StringContainer;
	private submitted: BoolArrayContainer;

	public name: string; // internal name
	public id: number; // sprite index
	public requiredItems: BundleRequiredItem[];
	public color: number | undefined;
	public reward: BundleReward | null;
	public room: CCRoom;
	public requiredItemCount: number;
	public readonly completed: boolean;

	constructor(
		bundleData: StringContainer,
		bundleKey: StringContainer,
		submitted: BoolArrayContainer,
	) {
		this.bundleData = bundleData;
		this.bundleKey = bundleKey;
		this.submitted = submitted;

		// Initialize reactive fields
		this.name = $state(parseBundleValue(this.bundleData.string).name ?? "");
		// Persist name when it changes
		$effect(() => {
			this.bundleData.string = withBundleName(
				this.bundleData.string,
				this.name,
			);
		});

		this.id = $state(parseBundleKey(this.bundleKey.string).spriteIndex);
		// Persist id (spriteIndex) when it changes
		$effect(() => {
			const { roomName, room } = parseBundleKey(this.bundleKey.string);
			this.bundleKey.string = serializeBundleKey({
				roomName,
				room,
				spriteIndex: this.id,
			});
		});

		// Room (constant unless key room portion changes externally)
		this.room = parseBundleKey(this.bundleKey.string).room;

		// Required items proxies
		const { requirements } = parseBundleValue(this.bundleData.string);
		this.requiredItems = $state(
			requirements.map(
				(_, i) => new BundleRequiredItem(this.submitted, this.bundleData, i),
			),
		);
		this.reward = new BundleReward(this.bundleData);

		// Derived values using $derived.by
		this.color = $derived(this.parse().color);
		this.requiredItemCount = $derived(
			this.parse().count ?? this.requiredItems.length,
		);
		this.completed = $derived.by(() => {
			const { count } = this.parse();
			const needed = count ?? this.requiredItems.length;
			let submitted = 0;
			for (const item of this.requiredItems) if (item.submitted) submitted++;
			return submitted >= needed;
		});
	}

	private parse() {
		return parseBundleValue(this.bundleData.string);
	}
}

class BundleRequiredItem {
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

	private parseRequirements(): BundleRequirement {
		const { requirements } = parseBundleValue(this.bundleData.string);
		const item = requirements[this.index];
		if (!item) throw new Error("Invalid bundle data");
		return item;
	}

	private persistRequirement(
		itemID: string,
		quantity: number,
		quality: number,
	) {
		this.bundleData.string = replaceRequirement(
			this.bundleData.string,
			this.index,
			[itemID, quantity, quality],
		);
	}

	private writeRequirement() {
		this.persistRequirement(
			this.itemID.toString(),
			this.quantity,
			this.quality,
		);
	}

	private writeSubmitted() {
		this.submit.boolean[this.index] = this.submitted;
	}
}

type Reward = {
	type: "O" | "BO";
	id: number;
	quantity: number;
};

class BundleReward implements DataProxy<StringContainer> {
	public [Raw]: StringContainer;
	public item?: Reward;

	constructor(bundleData: StringContainer) {
		this[Raw] = bundleData;
		this.item = $state();

		// Initial parse
		const parsed = parseBundleValue(this[Raw].string);
		if (parsed.reward) {
			const parts = parsed.reward.split(" ");
			if (parts.length >= 3) {
				const [type, itemID, quantity] = parts as [string, string, string];
				this.item = {
					type: type as "O" | "BO",
					id: Number.parseInt(itemID),
					quantity: Number.parseInt(quantity),
				};
			}
		}

		// Persist whenever reward object changes
		$effect(() => {
			const r = this.item;
			const rawReward = r ? `${r.type} ${r.id} ${r.quantity}` : undefined;
			this[Raw].string = withBundleReward(this[Raw].string, rawReward);
		});
	}
}
// Parsing / serialization helpers moved to bundleSerialization.ts
