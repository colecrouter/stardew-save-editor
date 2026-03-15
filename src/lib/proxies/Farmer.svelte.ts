import { Color } from "$lib/proxies/Color.svelte";
import { Inventory } from "$lib/proxies/Inventory.svelte";
import { MailBox, MailFlag } from "$lib/proxies/Mail.svelte";
import { Recipes } from "$lib/proxies/Recipes.svelte";
import { Professions, Skills } from "$lib/proxies/Skills.svelte";
import type { Gender, Player } from "$types/save";
import { type DataProxy, Raw } from ".";
import { Friendships } from "./Friendship.svelte";
import { BootsProxy, ClothingProxy, HatProxy, RingProxy } from "./items";

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
	public favoriteThing: string;
	public clubCoins: number;
	public skin: number;
	public accessory: number;
	public gender: Gender;
	public hairstyle: number;
	public hairColor: Color;
	public inventory: Inventory;

	public eyeColor: Color;

	private getEquipmentProxy<T>(
		slot: "hat" | "shirtItem" | "pantsItem" | "boots" | "leftRing" | "rightRing",
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
	public friendships: Friendships;

	// Provide compatibility alias for underlying raw object
	get raw() {
		return this[Raw];
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

		// Friendships reactive map (lookup by NPC name)
		this.friendships = new Friendships(this[Raw].friendshipData);

		// Unique ID snapshot
		this.uniqueID = this[Raw].UniqueMultiplayerID;

		this.craftingRecipes = new Recipes(
			player.craftingRecipes,
			"craftingRecipes",
		);
		this.cookingRecipes = new Recipes(player.cookingRecipes, "cookingRecipes");
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
