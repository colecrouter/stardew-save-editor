import type { ItemPresentation } from "./item-presentation.ts";
import {
	emptySlot,
	farmers,
	type Farmer,
	type SaveDocument,
} from "./domain.ts";

/** Serialized farmer fields, kept separate from positional backpack capacity. */
export const equipmentSlots = [
	"hat",
	"leftRing",
	"rightRing",
	"boots",
	"shirtItem",
	"pantsItem",
	"trinketItem",
] as const;
export type EquipmentSlot = (typeof equipmentSlots)[number];
export type EquipmentIdentities = Record<string, Record<EquipmentSlot, string>>;
export type InventoryLocation = number | EquipmentSlot;
export const equipmentLabels = {
	hat: "Hat",
	leftRing: "Left ring",
	rightRing: "Right ring",
	boots: "Boots",
	shirtItem: "Shirt",
	pantsItem: "Pants",
	trinketItem: "Trinket",
} as const satisfies Record<EquipmentSlot, string>;
export interface EquipmentSlotView extends ItemPresentation {
	readonly entityId: string;
	readonly key: EquipmentSlot;
	readonly label: string;
	readonly empty: boolean;
	readonly locked: boolean;
	readonly name: string;
	readonly itemId: string;
	readonly canStack: boolean;
	readonly canQuality: boolean;
	readonly quantity?: number;
	readonly quality?: number;
}
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
/** Positive serialized subtype checks avoid guessing equipment from names or generic IDs. */
export function canEquipItem(raw: unknown, key: EquipmentSlot): boolean {
	if (emptySlot(raw)) return true;
	if (!record(raw)) return false;
	const type = raw["@_xsi:type"];
	switch (key) {
		case "hat":
			return type === "Hat";
		case "boots":
			return type === "Boots";
		case "leftRing":
		case "rightRing":
			return type === "Ring" || type === "CombinedRing";
		case "trinketItem":
			return type === "Trinket";
		// Clothing uses the saved variant, not the ambiguous numeric item ID: shirts
		// and pants can share catalog IDs and must never be accepted interchangeably.
		case "shirtItem":
			return type === "Clothing" && raw.clothesType === "SHIRT";
		case "pantsItem":
			return type === "Clothing" && raw.clothesType === "PANTS";
	}
}
/** Unlock state is read without repairing malformed stats or imported equipment. */
export function trinketAvailable(farmer: unknown): boolean {
	if (!record(farmer)) return false;
	if (!emptySlot(farmer.trinketItem)) return true;
	const stats = record(farmer.stats) ? farmer.stats : undefined;
	const values = record(stats?.Values) ? stats.Values : undefined;
	return (
		Array.isArray(values?.item) &&
		values.item.some((entry: unknown) => {
			if (!record(entry) || !record(entry.key) || !record(entry.value))
				return false;
			return (
				typeof entry.key.string === "string" &&
				entry.key.string.toLowerCase() === "trinketslots" &&
				typeof entry.value.unsignedInt === "number" &&
				entry.value.unsignedInt > 0
			);
		})
	);
}
/** Resolve only unambiguous scalar owners; opaque unrelated farmers remain untouched. */
export function inventoryOwner(
	document: SaveDocument,
	id: string,
): Farmer | undefined {
	const matches = farmers(document).filter((farmer) => {
		if (!record(farmer)) return false;
		const value = farmer.UniqueMultiplayerID;
		return (
			(typeof value === "string" ||
				(typeof value === "number" && Number.isFinite(value))) &&
			String(value) === id
		);
	});
	return matches.length === 1 ? matches[0] : undefined;
}
