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
import type { Item } from "$types/save";
import { type DataProxy, Raw } from "..";
export { Raw };

export type ReportedMissingItemMetadata = {
	key: string;
	itemId: Item["itemId"] | undefined;
	name: string | undefined;
};

const reportedMissingItemMetadata = new Set<string>();

function normalizeMissingItemMetadata(raw: Item): ReportedMissingItemMetadata {
	return {
		key: `${raw.itemId ?? "unknown"}:${raw.name ?? ""}`,
		itemId: raw.itemId,
		name: raw.name,
	};
}

export function reportMissingItemMetadata(raw: Item) {
	const metadata = normalizeMissingItemMetadata(raw);
	if (reportedMissingItemMetadata.has(metadata.key)) return;
	reportedMissingItemMetadata.add(metadata.key);

	if (typeof window === "undefined") return;

	Sentry.logger.error("Item metadata missing from ItemData lookup", {
		itemId: metadata.itemId ?? null,
		name: metadata.name ?? null,
		type: raw._type ?? raw.type ?? null,
	});
}

export class ItemProxy<RawModel extends Item = Item>
	implements DataProxy<RawModel>
{
	public [Raw]: RawModel;

	readonly info?: ItemInformation;
	readonly sprite?: Sprite;

	protected _dispose?: () => void;

	public amount: number | undefined;
	public quality: number | undefined;
	public edibility: number | undefined;
	public price: number | undefined;
	public color: Color | undefined;

	constructor(raw: RawModel) {
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

	public dispose() {
		try {
			this._dispose?.();
		} finally {
			this._dispose = undefined;
		}
	}
}

function ensureItemName(raw: Item) {
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

function normalizeItemKey(itemId: Item["itemId"]): string | undefined {
	if (itemId == null) return undefined;
	if (typeof itemId === "number") return itemId.toString();
	if (typeof itemId === "string")
		return stripParenthesizedNumber(itemId) || undefined;
	return undefined;
}

function stripParenthesizedNumber(value: string) {
	return value.replace(/^\([^)]*\)/, "");
}

export function resolveItemInformation(raw: Item) {
	return raw.name === "Shirt"
		? Shirts.get(raw.itemId.toString())
		: ItemData.get(ItemNameHelper(raw));
}
