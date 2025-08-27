import { Color } from "$lib/proxies/Color.svelte";
import { Flags } from "$lib/proxies/Flags.svelte";
import { Inventory } from "$lib/proxies/Inventory.svelte";
import type { Item } from "$lib/proxies/Item.svelte";
import { Recipes } from "$lib/proxies/Recipes.svelte";
import { Skills } from "$lib/proxies/Skills.svelte";
import type { MailFlag } from "$lib/proxies/mail";
import type { Gender, Player } from "$types/save";
import { SvelteSet } from "svelte/reactivity";
import { type DataProxy, Raw } from ".";
import { Friendships } from "./Friendship.svelte";
import { Professions } from "./Professions.svelte";

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

	public hat: Item | undefined;
	public shirt: Item | undefined;
	public pants: Item | undefined;
	public boots: Item | undefined;
	public leftRing: Item | undefined;
	public rightring: Item | undefined;
	public eyeColor: Color;
	public flags: Flags;
	public skills: Skills;
	public professions: Professions;
	public uniqueID: number; // Readonly snapshot (underlying value shouldn't change)
	public mailReceived: Set<MailFlag>;
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

		this.hairColor = new Color(this[Raw].hairstyleColor);
		$effect(() => {
			this[Raw].hairstyleColor = this.hairColor;
		});

		this.inventory = new Inventory(this[Raw]);
		$effect(() => {
			this[Raw] = { ...this[Raw], ...this.inventory.raw };
		});

		// Equipment items (hat/shirt/pants/boots)
		this.hat = $state(this.inventory.hat);
		$effect(() => {
			this.inventory.hat = this.hat;
		});

		this.shirt = $state(this.inventory.shirt);
		$effect(() => {
			this.inventory.shirt = this.shirt;
		});

		this.pants = $state(this.inventory.pants);
		$effect(() => {
			this.inventory.pants = this.pants;
		});

		this.boots = $state(this.inventory.boots);
		$effect(() => {
			this.inventory.boots = this.boots;
		});

		this.leftRing = $state(this.inventory.leftRing);
		$effect(() => {
			this.inventory.leftRing = this.leftRing;
		});

		this.rightring = $state(this.inventory.rightRing);
		$effect(() => {
			this.inventory.rightRing = this.rightring;
		});

		this.eyeColor = new Color(this[Raw].newEyeColor);

		// Flags & skills proxies (no $state needed; they mutate raw directly)
		this.flags = new Flags(this[Raw]);
		this.skills = new Skills(this[Raw].experiencePoints.int ?? [], this[Raw]);

		// Professions as reactive set
		this.professions = new Professions(this[Raw].professions);

		// Mail received reactive set
		this.mailReceived = new SvelteSet(
			this[Raw].mailReceived.string as MailFlag[],
		);
		$effect(() => {
			this[Raw].mailReceived.string = Array.from(this.mailReceived);
		});

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

		// @ts-expect-error
		this.raw.items.Item = this.raw.items.Item.map((item) =>
			item === undefined ? { "@_xsi:nil": "true" } : item,
		);
		// @ts-expect-error
		this.raw.items.Item = this.raw.items.Item.map((item) =>
			item && "which" in item
				? { ...item, which: { "@_xsi:nil": "true" } }
				: item,
		);

		return JSON.stringify(this.raw);
	}
}
