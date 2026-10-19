import { SvelteMap } from "svelte/reactivity";
import {
	BUNDLE_QUALITIES,
	canHaveQuality,
	GOLD,
	ingredientKind,
	ingredientName,
	isValidIngredientId,
	MAX_BUNDLE_ITEMS,
	MAX_GOLD,
	MAX_INGREDIENT_STACK,
} from "$lib/bundleIngredients";
import { bundleSideEffects, CCRoom } from "$lib/bundleSideEffects";
import type { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type {
	BoolArrayContainer,
	GameLocation as GameLocationRaw,
	StringContainer,
} from "$types/save";
import { type DataProxy, Raw } from ".";
import {
	type BundleRequirement,
	parseBundleKey,
	parseBundleValue,
	serializeBundleKey,
	serializeBundleValue,
	withBundleName,
	withBundleReward,
} from "./bundleSerialization";
import { MailFlag } from "./Mail.svelte";

/*
    > Key: "Pantry/2"

    - [0] Room ID - "Pantry", "Crafts Room", "Fish Tank", "Boiler Room", "Vault", "Bulletin Board", "Abandoned Joja Mart"
    - [1] Bundle index, also its sprite in LooseSprites/JunimoNote

    > Value: "Fall Crops/BO 10 1/270 1 0 272 1 0 276 1 0 280 1 0/2///Fall Crops"

    - [0] Bundle name - Internal name
    - [1] Reward item - <item type> <item ID> <quantity> (blank for the Missing Bundle)
    - [2] Requirements - [<item ID> <quantity> <min quality>]... (see $lib/bundleIngredients)
    - [3] Color - [incomplete, complete] (same as key[1]??)
        -> 0 = green, green
        -> 1 = purple, purple
        -> 2 = orange, orange
        -> 3 = yellow, pink
        -> 4 = red, flower(?)
        -> 5 = blue, blue
        -> 6 = teal, teal
    - [4] Number of slots - How many items finish the bundle (up to 12); blank for every item
    - [5] Sprite override (usually blank)
    - [6] Display name

    > The CommunityCenter's `bundles`: three slots per requirement (NetWorldState.SetBundleData).
      A donated requirement ticks the first slot for it; finishing the bundle ticks every slot.
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
	/** The Abandoned JojaMart's Missing Bundle (not the Vault room) */
	Missing = 36,
}

/**
 * Represents the community bundles in the game, and their current completion status.
 */
export class CommunityBundles extends SvelteMap<BundleName, Bundle> {
	private communityCenter: GameLocation;
	private saveData: SaveProxy;
	private hasRunOnce = false;
	/** Each bundle's completion when side effects last ran, to spot bundles that change */
	private lastCompletion = new Map<BundleName, boolean>();
	/** Each room's completion when side effects last ran */
	private lastRooms = new Map<CCRoom, boolean>();
	/** Whether the whole Community Center was complete when side effects last ran */
	private lastOverall = false;
	/** Joja membership when side effects last ran */
	private lastJoja = false;

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

		// Apply proper save side effects (only after initialization, when user makes changes)
		$effect(() => this.applySideEffects());
	}

	/**
	 * Takes the existing bundle completion data, applies the appropriate changes.
	 * Toggles "completeness" of CC rooms whose bundles are no longer completed.
	 * Gives the appropriate world changes, e.g. unlocking the bus stop.
	 */
	private applySideEffects() {
		// Get all bundles, group by room
		// NOTE: We must access reactive values BEFORE checking hasRunOnce to establish
		// dependency tracking, otherwise the effect won't re-run when bundles change
		const bundlesByRoom = Map.groupBy(this.values(), (b: Bundle) => b.room);

		// Figure out which rooms are completed
		const completedRooms = [...bundlesByRoom.entries()].map(
			([room, bundles]) =>
				[room, bundles.every((b: Bundle) => b.completed)] as const,
		);
		// Re-run when Joja membership changes, so the joja* room flags follow it.
		// Read it from the host, as the game does (Game1.MasterPlayer): reading the
		// selected farmer would re-run this every time another farmer is picked.
		const isJoja =
			this.saveData.players[0]?.mailReceived.has(MailFlag.JojaMember) ?? false;
		const overallComplete = this.isOverallComplete(completedRooms, isJoja);
		const completion = new Map(
			[...this.entries()].map(([id, b]) => [id, b.completed] as const),
		);

		// Skip side effects on first run (initial load) to preserve existing player mail flags
		if (!this.hasRunOnce) {
			this.hasRunOnce = true;
			this.lastCompletion = completion;
			this.lastRooms = new Map(completedRooms);
			this.lastOverall = overallComplete;
			this.lastJoja = isJoja;
			return;
		}

		const jojaChanged = isJoja !== this.lastJoja;
		this.updateRewards(completion);
		this.lastCompletion = completion;

		// Apply side effects only to rooms whose completion changed, plus finished rooms
		// when membership changes so their joja* flags follow it. Leaving the other rooms
		// alone keeps flags the game sets without bundles, such as bought Joja projects.
		for (const [room, completed] of completedRooms) {
			const changed = this.lastRooms.get(room) !== completed;
			if (!changed && !(jojaChanged && completed)) continue;
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

		/*
			Overall Community Center completion semantics (vanilla reference):

			- The game considers the CC "complete" (mail flag ccIsComplete) once the SIX original rooms are restored: Pantry, Crafts Room, Fish Tank, Boiler Room, Vault, Bulletin Board.
			- Movie Theater content (CCRoom.AbandonedJojaMart) is an extension that only appears AFTER ccIsComplete. Its bundle should *not* be required to retain ccIsComplete, nor should its incompleteness revoke abandonedJojaMartAccessible.
			- Non‑Joja route: require the six original rooms (exclude AbandonedJojaMart).
			- Joja route: we still model room completion flags for side effects, but Bulletin Board and AbandonedJojaMart are not required.
			- Resulting mail flags we manage in the null sideEffect pair:
				- ccIsComplete: set when predicate true
				- abandonedJojaMartAccessible: set only for NON‑Joja players when predicate true (Door access after the post‑storm cutscene)

			Regression root cause (#80): we previously required AbandonedJojaMart for the non‑Joja branch, so any edit while that room was incomplete caused ccIsComplete & door access to be removed, resealing the door mid‑progress.

			Like the rooms, the flags only change when overall completion (or membership) does,
			so a Community Center the game finished without bundles (e.g. by buying every Joja
			project) keeps ccIsComplete while other bundles are edited.
		*/
		const overallChanged = overallComplete !== this.lastOverall;
		if (overallComplete && (overallChanged || jojaChanged)) {
			const pair = bundleSideEffects.get(null);
			if (pair) {
				pair.add(this.saveData, this.communityCenter);
				console.debug("Applied side effect for completed CC");
			}
		} else if (!overallComplete && overallChanged) {
			const pair = bundleSideEffects.get(null);
			if (pair) {
				pair.remove(this.saveData, this.communityCenter);
				console.debug("Removed side effect for completed CC");
			}
		}

		this.lastRooms = new Map(completedRooms);
		this.lastOverall = overallComplete;
		this.lastJoja = isJoja;

		// After applying any side effects, ensure bundleRewards remains valid/safe
		this.sanitizeBundleRewards();
	}

	/** Whether the Community Center counts as complete (see the notes in applySideEffects) */
	private isOverallComplete(
		completedRooms: ReadonlyArray<readonly [CCRoom, boolean]>,
		isJoja: boolean,
	) {
		return isJoja
			? // Joja route: ignore Abandoned Joja Mart & Bulletin Board (not required / no Joja analog)
				completedRooms
					.filter(
						([r]) =>
							![CCRoom.AbandonedJojaMart, CCRoom.BulletinBoard].includes(r),
					)
					// All remaining rooms must be complete
					.every(([, done]) => done)
			: // Non-Joja route: ignore only Abandoned Joja Mart (post-completion content)
				completedRooms
					.filter(([r]) => r !== CCRoom.AbandonedJojaMart)
					// All six core rooms must be complete
					.every(([, done]) => done);
	}

	/**
	 * Mirror the game: finishing a bundle leaves its reward waiting in
	 * bundleRewards, collected from the present in that room's bundle menu
	 * (JunimoNoteMenu.checkIfBundleIsComplete). Un-finishing a bundle takes
	 * back a reward that hasn't been collected.
	 */
	private updateRewards(completion: Map<BundleName, boolean>) {
		const ccRaw = this.communityCenter[Raw] as GameLocationRaw;
		for (const [id, completed] of completion) {
			if (this.lastCompletion.get(id) === completed) continue;
			// A waiting reward for a bundle without one (the Missing Bundle) crashes
			// the game, which builds it from the empty reward text (see sanitizeBundleRewards)
			if (
				completed &&
				(id === BundleName.Missing || !this.get(id)?.reward?.item)
			)
				continue;

			// An empty <bundleRewards /> parses as ""
			if (typeof ccRaw.bundleRewards !== "object" || !ccRaw.bundleRewards)
				ccRaw.bundleRewards = { item: [] };
			ccRaw.bundleRewards.item ??= [];
			const entry = ccRaw.bundleRewards.item.find((kv) => kv.key.int === id);
			if (entry) entry.value.boolean = completed;
			else
				ccRaw.bundleRewards.item.push({
					key: { int: id },
					value: { boolean: completed },
				});
		}
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

		// The Missing Bundle's reward crashes the game, so keep it false
		for (const kv of rewards.item) {
			if (kv.key.int === BundleName.Missing && kv.value.boolean === true) {
				kv.value.boolean = false;
				console.warn(
					"Corrected bundleRewards[36] from true to false to prevent a crash",
				);
			}
		}
	}
}

/** A Vault bundle's name, which is its price ("2,500g") */
const goldLabel = (gold: number) => `${gold.toLocaleString("en-US")}g`;

/** Why `id` can't be one of a bundle's items, if it can't */
function ingredientProblem(id: string, isVault: boolean) {
	if (!isValidIngredientId(id)) return `"${id}" can't be a bundle item`;
	if (isVault && id !== GOLD)
		return "Vault bundles are bought with gold, so only the price can change";
	if (!isVault && id === GOLD) return "Only Vault bundles are bought with gold";
}

/** Why a slot can't ask for `value` of `id`, if it can't */
function quantityProblem(id: string, value: number) {
	const gold = id === GOLD;
	const max = gold ? MAX_GOLD : MAX_INGREDIENT_STACK;
	if (!Number.isInteger(value) || value < 1 || value > max)
		return `${gold ? "The price" : "The amount"} must be 1 to ${max.toLocaleString("en-US")}`;
}

/**
 * Why a slot for `id` can't ask for `quality`, if it can't. `loaded` is the
 * quality it had in the save, which is kept even if it isn't a usual one.
 */
function qualityProblem(id: string, quality: number, loaded?: number) {
	if (id === GOLD) return "A Vault bundle's gold has no quality";
	if (!BUNDLE_QUALITIES.has(quality) && quality !== loaded)
		return `${quality} isn't a quality`;
	if (quality > 0 && !canHaveQuality(id))
		return `${ingredientName(id)} never has a quality, so no item could fill the slot`;
}

/** Bundle: finished once enough items are in, or every one is */
const isFinished = (donated: number, needed: number, items: number) =>
	donated >= needed || donated === items;

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
	/** How many of the items finish the bundle */
	public readonly requiredItemCount: number;
	public readonly completed: boolean;

	/** The bundle's "number of slots": how many items finish it, or every item when it's blank */
	#count = $state<number | undefined>();
	/** How the bundle's items tell it they changed */
	#itemOwner: ItemOwner = {
		isVault: () => this.isVault,
		writeItems: () => this.writeItems(),
		writeSlots: () => this.writeSlots(),
	};

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
		// Persist name when it changes; loading a save doesn't rewrite it
		let nameLoaded = false;
		$effect(() => {
			const name = this.name;
			if (!nameLoaded) {
				nameLoaded = true;
				return;
			}
			this.bundleData.string = withBundleName(this.bundleData.string, name);
		});

		this.id = $state(parseBundleKey(this.bundleKey.string).spriteIndex);
		// Persist id (spriteIndex) when it changes
		let idLoaded = false;
		$effect(() => {
			const spriteIndex = this.id;
			if (!idLoaded) {
				idLoaded = true;
				return;
			}
			const { roomName, room } = parseBundleKey(this.bundleKey.string);
			this.bundleKey.string = serializeBundleKey({
				roomName,
				room,
				spriteIndex,
			});
		});

		// Room (constant unless key room portion changes externally)
		this.room = parseBundleKey(this.bundleKey.string).room;

		// Required items proxies
		const { requirements, count } = parseBundleValue(this.bundleData.string);
		this.#count = count;
		const slots = this.submitted.boolean;
		this.requiredItems = $state(
			requirements.map(
				([id, quantity, quality], i) =>
					new BundleRequiredItem(
						this.#itemOwner,
						id,
						quantity,
						quality,
						slots[i] === true,
					),
			),
		);
		this.reward = new BundleReward(this.bundleData);

		// Derived values using $derived.by
		this.color = $derived(this.parse().color);
		this.requiredItemCount = $derived(this.#count ?? this.requiredItems.length);
		this.completed = $derived.by(() => {
			const donated = this.requiredItems.filter((i) => i.submitted).length;
			return isFinished(
				donated,
				this.requiredItemCount,
				this.requiredItems.length,
			);
		});
	}

	private parse() {
		return parseBundleValue(this.bundleData.string);
	}

	/**
	 * Vault bundles are bought with gold: the bundle menu has a purchase button
	 * that charges the last item's stack, whatever the items are (JunimoNoteMenu)
	 */
	get isVault() {
		return this.room === CCRoom.Vault;
	}

	/** What a Vault bundle costs, in gold */
	get price() {
		return this.requiredItems.at(-1)?.quantity ?? 0;
	}

	set price(gold: number) {
		const item = this.requiredItems.at(-1);
		if (!this.isVault || !item)
			throw new Error("Only Vault bundles have a price");
		item.quantity = gold;
	}

	/**
	 * Donate every item, as finishing a bundle in-game does: the game then marks
	 * every one of its slots as done (JunimoNoteMenu.checkIfBundleIsComplete)
	 */
	complete() {
		for (const item of this.requiredItems) item.submitted = true;
	}

	/** Take back every donated item */
	clear() {
		for (const item of this.requiredItems) item.submitted = false;
	}

	/** Why `id` can't be added to the bundle, if it can't */
	addItemProblem(id: string) {
		if (this.isVault)
			return "Vault bundles are bought with gold, so only the price can change";
		if (this.requiredItems.length >= MAX_BUNDLE_ITEMS)
			return `A bundle can't have more than ${MAX_BUNDLE_ITEMS} items`;
		return ingredientProblem(id, this.isVault);
	}

	/** Add an item for the bundle to ask for */
	addItem(id: string, quantity = 1, quality = 0) {
		const problem =
			this.addItemProblem(id) ??
			quantityProblem(id, quantity) ??
			qualityProblem(id, quality);
		if (problem) throw new Error(problem);
		// A bundle the game counts as finished has every slot ticked, so the new one is too
		const donated =
			this.requiredItems.length > 0 &&
			this.requiredItems.every((i) => i.submitted);
		const item = new BundleRequiredItem(
			this.#itemOwner,
			id,
			quantity,
			quality,
			donated,
		);
		this.requiredItems.push(item);
		this.writeItems();
		this.writeSlots(true);
		return item;
	}

	/**
	 * Why the item at `index` can't be removed, if it can't. Removing an item
	 * mustn't finish or un-finish the bundle: that would change the room's
	 * rewards behind the player's back.
	 */
	removeItemProblem(index: number) {
		if (this.isVault)
			return "Vault bundles are bought with gold, so only the price can change";
		if (!this.requiredItems[index]) return "There's no such item";
		const items = this.requiredItems.length - 1;
		if (items < 1) return "A bundle needs at least one item";
		const needed = Math.min(this.#count ?? items, items);
		const donated = this.requiredItems.filter(
			(item, i) => i !== index && item.submitted,
		).length;
		if (isFinished(donated, needed, items) !== this.completed)
			return this.completed
				? "Removing it would leave the bundle unfinished"
				: "Removing it would finish the bundle, as the rest are donated";
	}

	/** Stop the bundle asking for the item at `index` */
	removeItem(index: number) {
		const problem = this.removeItemProblem(index);
		if (problem) throw new Error(problem);
		this.requiredItems.splice(index, 1);
		if (this.#count !== undefined)
			this.#count = Math.min(this.#count, this.requiredItems.length);
		this.writeItems();
		this.writeSlots(true);
	}

	/** Why the bundle can't need `count` items, if it can't */
	requiredItemCountProblem(count: number) {
		const items = this.requiredItems.length;
		if (this.isVault)
			return "Vault bundles are bought with gold, so only the price can change";
		if (!Number.isInteger(count) || count < 1 || count > items)
			return `A bundle needs 1 to ${items} of its items`;
		const donated = this.requiredItems.filter((i) => i.submitted).length;
		if (isFinished(donated, count, items) !== this.completed)
			return this.completed
				? `Only ${donated} items are donated, so needing ${count} would leave the bundle unfinished`
				: `${donated} items are donated, so needing ${count} would finish the bundle`;
	}

	/** Change how many of the items finish the bundle */
	setRequiredItemCount(count: number) {
		const problem = this.requiredItemCountProblem(count);
		if (problem) throw new Error(problem);
		// A blank count asks for every item; keep it blank while that's what's asked
		this.#count =
			this.#count === undefined && count === this.requiredItems.length
				? undefined
				: count;
		this.writeItems();
	}

	/** Write the items and how many are needed back to the bundle's data */
	private writeItems() {
		const parsed = this.parse();
		const before = parsed.requirements.at(-1)?.[1];
		parsed.requirements = this.requiredItems.map((item) => item.requirement);
		parsed.count = this.#count;

		// A Vault bundle is named after its price, so rename it with the price
		if (this.isVault && before !== undefined && before !== this.price) {
			const was = goldLabel(before);
			const now = goldLabel(this.price);
			if (parsed.name === was) {
				parsed.name = now;
				this.name = now;
			}
			// The display name, after the sprite field
			if (parsed.tailSegments?.[1] === was) parsed.tailSegments[1] = now;
		}

		this.bundleData.string = serializeBundleValue(parsed);
	}

	/**
	 * Write which items are donated to the bundle's slots. The game keeps three
	 * slots per item (NetWorldState.SetBundleData) and reads the first one for
	 * each item; the rest are only ticked once the bundle is finished
	 * (JunimoNoteMenu.checkIfBundleIsComplete). `resize` fits them to the items
	 * after items are added or removed.
	 */
	private writeSlots(resize = false) {
		const slots = this.submitted.boolean;
		const items = this.requiredItems;
		const finished = this.completed;
		if (resize) slots.length = items.length * 3;
		const length = Math.max(slots.length, items.length);
		for (let i = 0; i < length; i++) slots[i] = items[i]?.submitted ?? finished;
	}
}

/** How an item tells its bundle it changed */
interface ItemOwner {
	isVault(): boolean;
	writeItems(): void;
	writeSlots(): void;
}

class BundleRequiredItem {
	#owner: ItemOwner;
	#id = $state("");
	#quantity = $state(1);
	#quality = $state(0);
	#submitted = $state(false);
	/** The quality as loaded, kept even when it isn't one of the usual ones */
	#loadedQuality: number;

	constructor(
		owner: ItemOwner,
		id: string,
		quantity: number,
		quality: number,
		submitted: boolean,
	) {
		this.#owner = owner;
		this.#id = id;
		this.#quantity = quantity;
		this.#quality = quality;
		this.#loadedQuality = quality;
		this.#submitted = submitted;
	}

	/**
	 * The item's ID: a number when it's numeric (negative for a category, -1
	 * for gold), else text (1.6 content keys like "SummerSquash")
	 */
	get itemID(): string | number {
		return /^-?\d+$/.test(this.#id) ? Number(this.#id) : this.#id;
	}

	set itemID(value: string | number) {
		const id = String(value);
		const problem = ingredientProblem(id, this.#owner.isVault());
		if (problem) throw new Error(problem);
		this.#id = id;
		// A slot can't ask for a quality its new item never has
		if (!canHaveQuality(id)) this.#quality = 0;
		this.#owner.writeItems();
	}

	/** Gold, a category, an object, or something unknown (from a mod) */
	get kind() {
		return ingredientKind(this.#id);
	}

	/** How many the slot needs: a stack of items, or a Vault bundle's price */
	get quantity() {
		return this.#quantity;
	}

	set quantity(value: number) {
		const problem = quantityProblem(this.#id, value);
		if (problem) throw new Error(problem);
		// The Vault's gold has its price as its quality too ("-1 2500 2500")
		if (this.#id === GOLD && this.#quality === this.#quantity)
			this.#quality = value;
		this.#quantity = value;
		this.#owner.writeItems();
	}

	/** The minimum quality the slot takes */
	get quality() {
		return this.#quality;
	}

	set quality(value: number) {
		if (value === this.#quality) return;
		const problem = qualityProblem(this.#id, value, this.#loadedQuality);
		if (problem) throw new Error(problem);
		this.#quality = value;
		this.#owner.writeItems();
	}

	/** Whether the item has been donated */
	get submitted() {
		return this.#submitted;
	}

	set submitted(value: boolean) {
		this.#submitted = value;
		this.#owner.writeSlots();
	}

	/** The item as the bundle's data has it */
	get requirement(): BundleRequirement {
		return [this.#id, this.#quantity, this.#quality];
	}
}

type Reward = {
	type: "O" | "BO";
	// Item identifier: may be a numeric ID (e.g. "680") or a string key (e.g. "DeluxeBait").
	id: string;
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
				// Accept string item IDs (e.g. "DeluxeBait") or numeric ones; store as string.
				const qty = Number.parseInt(quantity, 10);
				this.item = {
					type: type as "O" | "BO",
					id: itemID, // keep raw key to support string IDs
					quantity: Number.isNaN(qty) ? 1 : qty,
				};
			}
		}

		// Persist whenever reward object changes; loading a save doesn't rewrite it
		let loaded = false;
		$effect(() => {
			const r = this.item;
			const rawReward = r ? `${r.type} ${r.id} ${r.quantity}` : undefined;
			if (!loaded) {
				loaded = true;
				return;
			}
			this[Raw].string = withBundleReward(this[Raw].string, rawReward);
		});
	}
}
// Parsing / serialization helpers moved to bundleSerialization.ts
