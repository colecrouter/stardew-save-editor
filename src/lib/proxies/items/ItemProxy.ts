import * as Sentry from "@sentry/sveltekit";
import {
	CategoriesWithQuality,
	ItemData,
	ItemNameHelper,
	KeyToName,
	Shirts,
} from "$lib/ItemData";
import { Color } from "$lib/proxies/Color.svelte";
import { Sprite } from "$lib/Sprite.svelte";
import type { ItemInformation } from "$types/items";
import type { Item as ItemModel } from "$types/save";
import { type DataProxy, Raw } from "..";
import type { ItemModelBase } from "./types";
export { Raw };

export type ReportedMissingItemMetadata = {
	key: string;
	itemId: ItemModel["itemId"] | undefined;
	name: string | undefined;
};

const reportedMissingItemMetadata = new Set<string>();

function normalizeMissingItemMetadata(
	raw: ItemModelBase,
): ReportedMissingItemMetadata {
	return {
		key: `${raw.itemId ?? "unknown"}:${raw.name ?? ""}`,
		itemId: raw.itemId,
		name: raw.name,
	};
}

export function reportMissingItemMetadata(raw: ItemModelBase) {
	const metadata = normalizeMissingItemMetadata(raw);
	if (reportedMissingItemMetadata.has(metadata.key)) return;
	reportedMissingItemMetadata.add(metadata.key);

	if (typeof window === "undefined") return;

	Sentry.logger.error("Item metadata missing from ItemData lookup", {
		itemId: metadata.itemId ?? null,
		name: metadata.name ?? null,
		type: raw.type ?? null,
	});
}

export class ItemProxy implements DataProxy<ItemModelBase> {
	public [Raw]: ItemModelBase;

	readonly info?: ItemInformation;
	readonly sprite?: Sprite;

	protected _dispose?: () => void;

	public amount: number | undefined;
	public quality: number | undefined;
	public edibility: number | undefined;
	public price: number | undefined;
	public color: Color | undefined;
	public minDamage: number | undefined;
	public maxDamage: number | undefined;
	public speed: number | undefined;
	public knockback: number | undefined;
	public critChance: number | undefined;
	public critMultiplier: number | undefined;
	public precision: number | undefined;
	public areaOfEffect: number | undefined;
	public defense: number | undefined;
	public immunityBonus: number | undefined;
	public isBottomless: boolean | undefined;
	public generationSeed: number | undefined;

	constructor(raw: ItemModelBase) {
		this[Raw] = raw;
		ensureItemName(this[Raw]);
		const info = resolveItemInformation(raw);
		if (!info) {
			console.warn(`Item "${raw.name}" not found in ItemData`);
			reportMissingItemMetadata(raw);
		}

		this.info = info;
		this.sprite = info ? new Sprite(info) : undefined;

		this.amount = $state(this.computeAmount());
		$effect(() => this.syncAmount());

		this.quality = $state(this.computeQuality());
		$effect(() => this.syncQuality());

		this.edibility = $state(this.computeEdibility());
		$effect(() => this.syncEdibility());

		this.price = $state(this.computePrice());
		$effect(() => this.syncPrice());

		this.color = $state(this.computeColor());
		$effect(() => this.syncColor());

		this.minDamage = $state(
			this.info?._type === "Weapon" ? this[Raw].minDamage : undefined,
		);
		$effect(() => this.syncMinDamage());

		this.maxDamage = $state(
			this.info?._type === "Weapon" ? this[Raw].maxDamage : undefined,
		);
		$effect(() => this.syncMaxDamage());

		this.speed = $state(
			this.info?._type === "Weapon" ? this[Raw].speed : undefined,
		);
		$effect(() => this.syncSpeed());

		this.knockback = $state(
			this.info?._type === "Weapon" ? this[Raw].knockback : undefined,
		);
		$effect(() => this.syncKnockback());

		this.critChance = $state(
			this.info?._type === "Weapon" ? this[Raw].critChance : undefined,
		);
		$effect(() => this.syncCritChance());

		this.critMultiplier = $state(
			this.info?._type === "Weapon" ? this[Raw].critMultiplier : undefined,
		);
		$effect(() => this.syncCritMultiplier());

		this.precision = $state(
			this.info?._type === "Weapon" ? this[Raw].addedPrecision : undefined,
		);
		$effect(() => this.syncPrecision());

		this.areaOfEffect = $state(
			this.info?._type === "Weapon" ? this[Raw].addedAreaOfEffect : undefined,
		);
		$effect(() => this.syncAreaOfEffect());

		this.defense = $state(
			this.info && ["Boots", "Weapon"].includes(this.info._type)
				? this[Raw].addedDefense
				: undefined,
		);
		$effect(() => this.syncDefense());

		this.immunityBonus = $state(
			this.info?._type === "Boots" ? this[Raw].immunityBonus : undefined,
		);
		$effect(() => this.syncImmunity());

		this.isBottomless = $state(
			this[Raw].name === "Watering Can" ? this[Raw].isBottomless : undefined,
		);
		$effect(() => this.syncBottomless());

		this.generationSeed = $state(
			this.info?._type === "Trinket" ? this[Raw].generationSeed : undefined,
		);
		$effect(() => this.syncGenerationSeed());
	}

	get name(): string {
		return ItemNameHelper(this[Raw]);
	}

	get id() {
		return this[Raw].itemId;
	}

	get type() {
		return this.info?._type;
	}

	get category() {
		return this[Raw].category;
	}

	private computeAmount() {
		if (!this.info) return undefined;
		if (
			["Clothing", "Boots", "Hat", "Weapon", "Pants", "Shirt", "Tool"].includes(
				this.info._type,
			)
		)
			return undefined;
		return this[Raw].stack ?? 1;
	}

	private syncAmount() {
		if (!this.info) return;
		const applicable = ![
			"Clothing",
			"Boots",
			"Hat",
			"Weapon",
			"Pants",
			"Shirt",
			"Tool",
		].includes(this.info._type);
		if (!applicable) {
			if (this.amount !== undefined) {
				console.warn("Amount not applicable to this item type; resetting.");
			}
			this.amount = undefined;
			return;
		}
		if (this.amount === undefined) return;
		if (this.amount < 1) this.amount = 1;
		this[Raw].stack = this.amount;
	}

	private computeQuality() {
		if (!this[Raw].category) return undefined;
		if (!CategoriesWithQuality.has(this[Raw].category)) return undefined;
		return this[Raw].quality;
	}

	private syncQuality() {
		if (this.quality === undefined) return;
		if (this.quality < 0) this.quality = 0;
		if (this.quality === 3) this.quality = 2;
		if (this.quality > 4) this.quality = 4;
		this[Raw].quality = this.quality;
	}

	private computeEdibility() {
		if (!("edibility" in this[Raw]) || this[Raw].edibility === -300)
			return undefined;
		return this[Raw].edibility;
	}

	private syncEdibility() {
		if (this.edibility === undefined) return;
		this[Raw].edibility = this.edibility;
	}

	private computePrice() {
		if (
			!this.info ||
			!["Object", "BigCraftable", "Furniture", "Hat", "Clothing"].includes(
				this.info._type,
			)
		)
			return undefined;
		return this[Raw].price;
	}

	private syncPrice() {
		if (this.price === undefined) return;
		if (this.price < 0) this.price = 0;
		if (this.price > 99999) this.price = 99999;
		this[Raw].price = this.price;
	}

	private computeColor() {
		if (
			!this.info ||
			!("canBeDyed" in this.info) ||
			!this.info.canBeDyed ||
			!this[Raw].clothesColor
		)
			return undefined;
		return new Color(this[Raw].clothesColor);
	}

	private syncColor() {
		if (!this.color) return;
		this[Raw].clothesColor = this.color;
	}

	private syncMinDamage() {
		if (this.minDamage === undefined) return;
		if (this.minDamage < 0) this.minDamage = 0;
		if (this.minDamage > 999) this.minDamage = 999;
		this[Raw].minDamage = this.minDamage;
	}

	private syncMaxDamage() {
		if (this.maxDamage === undefined) return;
		if (this.maxDamage < 0) this.maxDamage = 0;
		if (this.maxDamage > 999) this.maxDamage = 999;
		this[Raw].maxDamage = this.maxDamage;
	}

	private syncSpeed() {
		if (this.speed === undefined) return;
		if (this.speed < 0) this.speed = 0;
		if (this.speed > 999) this.speed = 999;
		this[Raw].speed = this.speed;
	}

	private syncKnockback() {
		if (this.knockback === undefined) return;
		if (this.knockback < 0) this.knockback = 0;
		if (this.knockback > 999) this.knockback = 999;
		this[Raw].knockback = this.knockback;
	}

	private syncCritChance() {
		if (this.critChance === undefined) return;
		if (this.critChance < 0) this.critChance = 0;
		if (this.critChance > 1) this.critChance = 1;
		this[Raw].critChance = this.critChance;
	}

	private syncCritMultiplier() {
		if (this.critMultiplier === undefined) return;
		if (this.critMultiplier < 0) this.critMultiplier = 0;
		this[Raw].critMultiplier = this.critMultiplier;
	}

	private syncPrecision() {
		if (this.precision === undefined) return;
		if (this.precision < 0) this.precision = 0;
		if (this.precision > 999) this.precision = 999;
		this[Raw].addedPrecision = this.precision;
	}

	private syncAreaOfEffect() {
		if (this.areaOfEffect === undefined) return;
		if (this.areaOfEffect < 0) this.areaOfEffect = 0;
		if (this.areaOfEffect > 999) this.areaOfEffect = 999;
		this[Raw].addedAreaOfEffect = this.areaOfEffect;
	}

	private syncDefense() {
		if (this.defense === undefined) return;
		if (this.defense < 0) this.defense = 0;
		if (this.defense > 999) this.defense = 999;
		this[Raw].addedDefense = this.defense;
	}

	private syncImmunity() {
		if (this.immunityBonus === undefined) return;
		if (this.immunityBonus < 0) this.immunityBonus = 0;
		this[Raw].immunityBonus = this.immunityBonus;
	}

	private syncBottomless() {
		if (this.isBottomless === undefined) return;
		this[Raw].isBottomless = this.isBottomless;
		this[Raw].IsBottomless = this.isBottomless;
	}

	private syncGenerationSeed() {
		if (this.generationSeed === undefined) return;
		this[Raw].generationSeed = this.generationSeed;
	}

	public dispose() {
		try {
			this._dispose?.();
		} finally {
			this._dispose = undefined;
		}
	}
}

function ensureItemName(raw: ItemModelBase) {
	if (raw.name) return;
	if (!raw._type) return;

	const lookupKey = normalizeItemKey(raw.itemId);
	if (!lookupKey) return;

	try {
		raw.name = KeyToName(lookupKey, raw._type);
	} catch (_error) {
		if (raw._type === "Trinket" && typeof raw.itemId === "string") {
			const trinketKey = stripParenthesizedNumber(raw.itemId);
			if (trinketKey) {
				try {
					raw.name = KeyToName(trinketKey, "Trinket");
				} catch {
					return;
				}
			}
		}
	}
}

function normalizeItemKey(itemId: ItemModelBase["itemId"]): string | undefined {
	if (itemId == null) return undefined;
	if (typeof itemId === "number") return itemId.toString();
	if (typeof itemId === "string")
		return stripParenthesizedNumber(itemId) || undefined;
	return undefined;
}

function stripParenthesizedNumber(value: string) {
	return value.replace(/^\([^)]*\)/, "");
}

export function resolveItemInformation(raw: ItemModelBase) {
	return raw.name === "Shirt"
		? Shirts.get(raw.itemId.toString())
		: ItemData.get(ItemNameHelper(raw));
}
