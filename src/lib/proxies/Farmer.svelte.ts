import { Color } from "$lib/proxies/Color.svelte";
import { Inventory } from "$lib/proxies/Inventory.svelte";
import { MailBox, MailFlag } from "$lib/proxies/Mail.svelte";
import { Recipes } from "$lib/proxies/Recipes.svelte";
import {
	masteryXpForLevel,
	Professions,
	Skills,
} from "$lib/proxies/Skills.svelte";
import type { Gender, Player, ToolItem } from "$types/save";
import { type DataProxy, Raw } from ".";
import { EventsSeen } from "./EventsSeen.svelte";
import { Friendships } from "./Friendship.svelte";
import { BootsProxy, ClothingProxy, HatProxy, RingProxy } from "./items";
import { QuestLog } from "./Quest.svelte";

const NIL_ATTR = "@_xsi:nil";
const walletFlagMap: ReadonlyArray<[legacyField: string, flag: MailFlag]> = [
	["canUnderstandDwarves", MailFlag.HasDwarvishTranslationGuide],
	["hasRustyKey", MailFlag.HasRustyKey],
	["hasClubCard", MailFlag.HasClubCard],
	["hasSpecialCharm", MailFlag.HasSpecialCharm],
	["hasSkullKey", MailFlag.HasSkullKey],
	["hasMagnifyingGlass", MailFlag.HasMagnifyingGlass],
	["hasDarkTalisman", MailFlag.HasDarkTalisman],
	["hasMagicInk", MailFlag.HasMagicInk],
	["HasTownKey", MailFlag.HasTownKey],
	["hasUnlockedSkullDoor", MailFlag.HasUnlockedSkullDoor],
];

// The game matches stat keys case-insensitively, so "MasteryExp" and "masteryExp" are one stat
const isStat = (key: string) => (stat: { key: { string: unknown } }) =>
	String(stat.key.string).toLowerCase() === key.toLowerCase();

export const getStatValue = (player: Player, key: string): number =>
	player.stats.Values?.item?.find(isStat(key))?.value.unsignedInt ?? 0;

const UINT_MAX = 4_294_967_295;

/** Set a stat, which the game leaves out when it's 0 (Stats.Set) */
export const setStatValue = (player: Player, key: string, value: number) => {
	// Stats are unsigned ints (Stats.Values); the game can't load anything else
	if (!Number.isInteger(value) || value < 0 || value > UINT_MAX)
		throw new Error(
			`The ${key} stat must be a whole number from 0 to ${UINT_MAX}`,
		);
	// An empty <Values /> parses as ""
	if (typeof player.stats.Values !== "object" || !player.stats.Values)
		player.stats.Values = { item: [] };
	player.stats.Values.item ??= [];
	const stats = player.stats.Values.item;
	const index = stats.findIndex(isStat(key));
	const stat = stats[index];
	if (value === 0) {
		if (stat) stats.splice(index, 1);
	} else if (stat) {
		stat.value.unsignedInt = value;
	} else {
		stats.push({ key: { string: key }, value: { unsignedInt: value } });
	}
};

/** Backpack sizes the game sells: the starting backpack, the Large Pack and the Deluxe Pack */
export const BACKPACK_SIZES: readonly number[] = [12, 24, 36];
/** The cellar; the game has no house map past it (FarmHouse.setMapForUpgradeLevel) */
export const MAX_HOUSE_UPGRADE_LEVEL = 3;
/** Robin takes 3 days to upgrade the house */
export const HOUSE_UPGRADE_DAYS = 3;
/** Clint takes 2 days to upgrade a tool */
export const TOOL_UPGRADE_DAYS = 2;
/** The iridium trash can */
export const MAX_TRASH_CAN_LEVEL = 4;

const isNilMarker = (value: unknown): boolean =>
	typeof value === "object" &&
	value !== null &&
	NIL_ATTR in (value as Record<string, unknown>) &&
	(value as Record<string, unknown>)[NIL_ATTR] === "true";

const migrateLegacyWalletFlags = (player: Player) => {
	if (!player.mailReceived) {
		player.mailReceived = { string: [] };
	}
	let mail = player.mailReceived.string;
	if (!Array.isArray(mail)) {
		mail = [];
		player.mailReceived.string = mail;
	}
	const record = player as unknown as Record<string, unknown>;
	for (const [field, flag] of walletFlagMap) {
		const current = record[field];
		if (current === "" || (current != null && !isNilMarker(current))) {
			if (!mail.includes(flag)) mail.push(flag);
		}
		if (field in record) delete record[field];
	}
};

export class Farmer implements DataProxy<Player> {
	public [Raw]: Player;

	public readonly craftingRecipes: Recipes<"craftingRecipes">;
	public readonly cookingRecipes: Recipes<"cookingRecipes">;

	public maxHealth: number;
	public maxStamina: number;
	public qiGems: number;
	public money: number;
	public totalMoneyEarned: number;
	public name: string;
	public farmName: string;
	/** The "Profit Margin" new-game option, as a price multiplier (1 = normal). The game reads the host's. */
	public difficultyModifier: number;
	public favoriteThing: string;
	public clubCoins: number;
	public skin: number;
	public accessory: number;
	public gender: Gender;
	public hairstyle: number;
	public hairColor: Color;
	public inventory: Inventory;

	public eyeColor: Color;

	// Only written to the save when edited, so loading a save never changes them
	#maxItems = $state(12);
	#trashCanLevel = $state(0);
	#daysUntilHouseUpgrade = $state(-1);
	#daysLeftForToolUpgrade = $state(0);
	#masteryExp = $state(0);

	private getEquipmentProxy<T>(
		slot:
			| "hat"
			| "shirtItem"
			| "pantsItem"
			| "boots"
			| "leftRing"
			| "rightRing",
		ProxyType: abstract new (...args: never[]) => T,
	): T | undefined {
		const item = this.inventory.get(slot);
		if (!item) return undefined;

		// Some saves can contain malformed or glitched equipment, like an Iridium Pan
		// written into the hat slot. The editor should still load those files and
		// simply treat the item as not renderable in the derived appearance accessors.
		return item instanceof ProxyType ? item : undefined;
	}

	// Derived equipment accessors delegate to Inventory
	get hat(): HatProxy | undefined {
		return this.getEquipmentProxy("hat", HatProxy);
	}
	set hat(value: HatProxy | undefined) {
		this.inventory.set("hat", value);
	}

	get shirt(): ClothingProxy | undefined {
		return this.getEquipmentProxy("shirtItem", ClothingProxy);
	}
	set shirt(value: ClothingProxy | undefined) {
		this.inventory.set("shirtItem", value);
	}

	get pants(): ClothingProxy | undefined {
		return this.getEquipmentProxy("pantsItem", ClothingProxy);
	}
	set pants(value: ClothingProxy | undefined) {
		this.inventory.set("pantsItem", value);
	}

	get boots(): BootsProxy | undefined {
		return this.getEquipmentProxy("boots", BootsProxy);
	}
	set boots(value: BootsProxy | undefined) {
		this.inventory.set("boots", value);
	}

	get leftRing(): RingProxy | undefined {
		return this.getEquipmentProxy("leftRing", RingProxy);
	}
	set leftRing(value: RingProxy | undefined) {
		this.inventory.set("leftRing", value);
	}

	get rightRing(): RingProxy | undefined {
		return this.getEquipmentProxy("rightRing", RingProxy);
	}

	set rightRing(value: RingProxy | undefined) {
		this.inventory.set("rightRing", value);
	}

	public skills: Skills;
	public professions: Professions;
	public uniqueID: number; // Readonly snapshot (underlying value shouldn't change)
	public mailReceived: MailBox;
	/** Letters waiting to be read in the in-game mailbox */
	public mailbox: MailBox;
	public friendships: Friendships;
	/** Events (cutscenes) the player has seen */
	public eventsSeen: EventsSeen;

	/** The journal */
	public questLog: QuestLog;

	// Provide compatibility alias for underlying raw object
	get raw() {
		return this[Raw];
	}

	get trinketSlots() {
		return getStatValue(this[Raw], "trinketSlots");
	}

	get trinketsUnlocked() {
		return this.trinketSlots > 0;
	}

	/** Backpack slots: 12, 24 or 36. Change it with {@link setBackpackSize} */
	get maxItems() {
		return this.#maxItems;
	}

	/** Why the backpack can't be made `size` slots, if it can't */
	#backpackProblem(size: number) {
		const slots = this.inventory.slotCount;
		if (!BACKPACK_SIZES.includes(size) || !BACKPACK_SIZES.includes(slots))
			return "Backpacks have 12, 24 or 36 slots";
		// Shrinking drops the last slots, so they have to be empty
		for (let i = size; i < slots; i++)
			if (!this.inventory.isEmpty(i))
				return `Empty slots ${size + 1} to ${slots} of the backpack first`;
	}

	/** Whether the backpack can be made `size` slots without losing anything */
	canResizeBackpack(size: number) {
		return this.#backpackProblem(size) === undefined;
	}

	/**
	    Make the backpack bigger, as buying one from Pierre does
	    (GameLocation "Backpack_Purchase": `maxItems` grows by 12, and the
	    inventory gets an empty slot for each new space), or smaller again.
	*/
	setBackpackSize(size: number) {
		const problem = this.#backpackProblem(size);
		if (problem) throw new Error(problem);
		this.inventory.adjustSlots(size);
		this.#maxItems = size;
		this[Raw].maxItems = size;
	}

	/**
	    The trash can's upgrade level, from 0 (basic) to 4 (iridium). Each level
	    gets back 15% more of a trashed item's price
	    (Utility.getTrashReclamationPrice).
	*/
	get trashCanLevel() {
		return this.#trashCanLevel;
	}

	set trashCanLevel(level: number) {
		if (!Number.isInteger(level) || level < 0 || level > MAX_TRASH_CAN_LEVEL)
			throw new Error(`The trash can's level is 0 to ${MAX_TRASH_CAN_LEVEL}`);
		// Collecting it from Clint upgrades it again
		if (this.trashCanAtClint)
			throw new Error("Clint is upgrading the trash can; collect it first");
		this.#trashCanLevel = level;
		this[Raw].trashCanLevel = level;
	}

	/** The tool (or trash can) Clint is upgrading, if there is one */
	get toolBeingUpgraded(): ToolItem | undefined {
		const tool = this[Raw].toolBeingUpgraded;
		return tool && !isNilMarker(tool) ? tool : undefined;
	}

	/** Whether the tool at Clint's is a trash can (CopperTrashCan to IridiumTrashCan) */
	get trashCanAtClint() {
		return /TrashCan$/.test(String(this.toolBeingUpgraded?.itemId ?? ""));
	}

	/**
	    Days until Clint finishes the {@link toolBeingUpgraded}. It goes down
	    overnight, and at 0 the tool is ready to collect.
	*/
	get daysLeftForToolUpgrade() {
		return this.#daysLeftForToolUpgrade;
	}

	set daysLeftForToolUpgrade(days: number) {
		if (!Number.isInteger(days) || days < 0 || days > TOOL_UPGRADE_DAYS)
			throw new Error(`Clint takes 0 to ${TOOL_UPGRADE_DAYS} days`);
		this.#daysLeftForToolUpgrade = days;
		this[Raw].daysLeftForToolUpgrade = days;
	}

	/**
	    The house's upgrade level, from 0 (the starting house) to 3 (with a
	    cellar). It goes up overnight; see {@link daysUntilHouseUpgrade}.
	*/
	get houseUpgradeLevel() {
		return this[Raw].houseUpgradeLevel ?? 0;
	}

	/**
	    Days until Robin finishes upgrading the house, or -1 when she isn't.
	    The night it reaches 0, the game upgrades the house itself, moving the
	    furniture out of the way (Farmer.dayupdate), so 1 upgrades it after the
	    next sleep. 0 or less stops the upgrade.
	*/
	get daysUntilHouseUpgrade() {
		return this.#daysUntilHouseUpgrade;
	}

	set daysUntilHouseUpgrade(days: number) {
		if (!Number.isInteger(days) || days > HOUSE_UPGRADE_DAYS)
			throw new Error(`Robin takes up to ${HOUSE_UPGRADE_DAYS} days`);
		if (days > 0 && this.houseUpgradeLevel >= MAX_HOUSE_UPGRADE_LEVEL)
			throw new Error("The house is fully upgraded");
		const value = days > 0 ? days : -1;
		this.#daysUntilHouseUpgrade = value;
		this[Raw].daysUntilHouseUpgrade = value;
	}

	/**
	    How many masteries the player has claimed in the Mastery Cave: the
	    `mastery_0` to `mastery_4` stats (0 Farming, 1 Fishing, 2 Foraging,
	    3 Mining, 4 Combat), or `MasteryLevelsSpent` if that's more
	*/
	get masteryLevelsSpent() {
		const claimed = [0, 1, 2, 3, 4].filter(
			(skill) => getStatValue(this[Raw], `mastery_${skill}`) > 0,
		).length;
		const spent = getStatValue(this[Raw], "MasteryLevelsSpent");
		return Math.min(masteryXpForLevel.length - 1, Math.max(claimed, spent));
	}

	/**
	    Mastery XP (the `MasteryExp` stat), earned once every skill is level 10.
	    It can't go below what the masteries already claimed cost, or the game
	    would have spent levels the player doesn't have.
	*/
	get masteryExp() {
		return this.#masteryExp;
	}

	set masteryExp(xp: number) {
		const spent = this.masteryLevelsSpent;
		const min = masteryXpForLevel[spent] ?? 0;
		if (Number.isInteger(xp) && xp < min)
			throw new Error(
				`${spent} ${spent === 1 ? "mastery is" : "masteries are"} claimed, which takes at least ${min} Mastery XP`,
			);
		// Refuses anything else a stat can't hold
		setStatValue(this[Raw], "MasteryExp", xp);
		this.#masteryExp = xp;
	}

	constructor(player: Player | undefined) {
		if (!player) throw new Error("No player provided");

		this[Raw] = player;

		this.maxHealth = $state(this[Raw].maxHealth);
		$effect(() => {
			this[Raw].maxHealth = this.maxHealth;
		});

		this.maxStamina = $state(this[Raw].maxStamina);
		$effect(() => {
			this[Raw].maxStamina = this.maxStamina;
		});

		this.qiGems = $state(this[Raw].qiGems);
		$effect(() => {
			this[Raw].qiGems = this.qiGems;
		});

		this.money = $state(this[Raw].money);
		$effect(() => {
			this[Raw].money = this.money;
		});

		this.totalMoneyEarned = $state(this[Raw].totalMoneyEarned);
		$effect(() => {
			this[Raw].totalMoneyEarned = this.totalMoneyEarned;
		});

		// Basic string/number fields converted to reactive state
		this.name = $state(this[Raw].name);
		$effect(() => {
			this[Raw].name = this.name;
		});

		this.farmName = $state(this[Raw].farmName);
		$effect(() => {
			this[Raw].farmName = this.farmName;
		});

		this.favoriteThing = $state(this[Raw].favoriteThing);
		$effect(() => {
			this[Raw].favoriteThing = this.favoriteThing;
		});

		this.difficultyModifier = $state(this[Raw].difficultyModifier ?? 1);
		$effect(() => {
			this[Raw].difficultyModifier = this.difficultyModifier;
		});

		this.clubCoins = $state(this[Raw].clubCoins);
		$effect(() => {
			this[Raw].clubCoins = this.clubCoins;
		});

		this.skin = $state(this[Raw].skin);
		$effect(() => {
			this[Raw].skin = this.skin;
		});

		this.accessory = $state(this[Raw].accessory);
		$effect(() => {
			this[Raw].accessory = this.accessory;
		});

		this.gender = $state(this[Raw].gender);
		$effect(() => {
			this[Raw].gender = this.gender;
			this[Raw].Gender = this.gender;
		});

		this.hairstyle = $state(
			this[Raw].hair >= 100 ? this[Raw].hair - 100 + 56 : this[Raw].hair,
		);
		$effect(() => {
			if (this.hairstyle >= 56) {
				this[Raw].hair = this.hairstyle + 100 - 56;
			} else {
				this[Raw].hair = this.hairstyle;
			}
		});

		// Hair color: keep a reactive Color and sync channel changes into raw
		this.hairColor = $state(new Color(this[Raw].hairstyleColor));
		$effect(() => {
			const c = this.hairColor;
			this[Raw].hairstyleColor = {
				B: c.B,
				G: c.G,
				R: c.R,
				A: c.A,
				PackedValue: c.PackedValue,
			};
		});

		this.inventory = new Inventory(this[Raw]);
		this.#maxItems = this[Raw].maxItems ?? this.inventory.slotCount;

		this.#trashCanLevel = this[Raw].trashCanLevel ?? 0;
		this.#daysUntilHouseUpgrade = this[Raw].daysUntilHouseUpgrade ?? -1;
		this.#daysLeftForToolUpgrade = this[Raw].daysLeftForToolUpgrade ?? 0;
		this.#masteryExp = getStatValue(this[Raw], "MasteryExp");

		// Eye color: keep a reactive Color and sync channel changes into raw
		this.eyeColor = $state(new Color(this[Raw].newEyeColor));
		$effect(() => {
			const c = this.eyeColor;
			this[Raw].newEyeColor = {
				B: c.B,
				G: c.G,
				R: c.R,
				A: c.A,
				PackedValue: c.PackedValue,
			};
		});

		migrateLegacyWalletFlags(this[Raw]);
		// Skills proxy (no $state needed; mutates raw directly)
		this.skills = new Skills(this[Raw]);

		// Professions as reactive set
		this.professions = new Professions(this[Raw].professions);

		// Mail received reactive set
		this.mailReceived = new MailBox(this[Raw].mailReceived);
		if (typeof this[Raw].mailbox !== "object" || !this[Raw].mailbox)
			this[Raw].mailbox = { string: [] };
		this[Raw].mailbox.string ??= [];
		this.mailbox = new MailBox(this[Raw].mailbox);

		// Friendships reactive map (lookup by NPC name)
		this.friendships = new Friendships(this[Raw].friendshipData);

		// An empty <eventsSeen /> parses as "" rather than a list
		if (typeof this[Raw].eventsSeen !== "object" || !this[Raw].eventsSeen)
			this[Raw].eventsSeen = {};
		this.eventsSeen = new EventsSeen(this[Raw].eventsSeen);

		// Needs the inventory and mail, for completing quests
		this.questLog = new QuestLog(this);

		// Unique ID snapshot
		this.uniqueID = this[Raw].UniqueMultiplayerID;

		this.craftingRecipes = new Recipes(
			player.craftingRecipes,
			"craftingRecipes",
		);
		this.cookingRecipes = new Recipes(player.cookingRecipes, "cookingRecipes");
	}

	/**
	    Start a conversation topic, so villagers can comment on it, unless the
	    player has already had it (Farmer.autoGenerateActiveDialogueEvent).

	    @param duration How many days it lasts
	    @returns Whether it was started
	*/
	autoGenerateActiveDialogueEvent(id: string, duration = 4) {
		const raw = this[Raw];
		// Farmer.hasSeenActiveDialogueEvent
		const seen = [raw.activeDialogueEvents, raw.previousActiveDialogueEvents]
			.flatMap((events) => (events ? (events.item ?? []) : []))
			.some((event) => String(event.key.string) === id);
		if (seen) return false;
		if (
			typeof raw.activeDialogueEvents !== "object" ||
			!raw.activeDialogueEvents
		)
			raw.activeDialogueEvents = { item: [] };
		raw.activeDialogueEvents.item ??= [];
		raw.activeDialogueEvents.item.push({
			key: { string: id },
			value: { int: duration },
		});
		return true;
	}

	toJSON() {
		// Undo type safety enhancements
		// 1. Inventory, switch undefined into <string xsi:nil="true" /> (for farmhands, too) (flags too)
		// To be honest this is all kind of a hack. Realistically, we need something to parse through each node and convert
		// undefined to the appropriate xsi:nil attribute, but I couldn't find such a feature in fast-xml-parser

		// @ts-expect-error - Need to widen type to assign nil sentinels
		this.raw.items.Item = this.raw.items.Item.map((item) =>
			item === undefined ? { "@_xsi:nil": "true" } : item,
		);
		this.raw.items.Item = this.raw.items.Item.map((item) =>
			item && "which" in item
				? { ...item, which: { "@_xsi:nil": "true" } }
				: item,
		);

		return JSON.stringify(this.raw);
	}
}
