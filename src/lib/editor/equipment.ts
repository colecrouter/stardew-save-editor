import { type Farmer } from "./domain.ts";
import { type InventoryValue, isSavedItem } from "./inventory-values.ts";
import { type ItemPresentation } from "./item-presentation.ts";
import { emptySlot } from "./saved-farmers.ts";

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
// The game saves trinkets as a list even though this editor exposes one slot.
// Preserve multi-trinket imports as opaque values instead of selecting an arbitrary item.
export function readEquipmentSlot(
	farmer: Farmer | undefined,
	slot: EquipmentSlot,
): InventoryValue {
	if (farmer === undefined) return undefined;
	if (slot === "trinketItem") {
		const value = farmer.trinketItem;
		return value && value.length <= 1 ? (value[0] ?? null) : value;
	}
	return farmer[slot];
}
/** Assign an already decoded item only to its matching generated equipment field.
 * Unsupported bundles/subclasses cannot acquire a concrete class through a write. */
export function writeEquipmentSlot(
	farmer: Farmer,
	slot: EquipmentSlot,
	value: InventoryValue,
): void {
	// Undefined clears serialized presence; null remains the explicit vacant slot.
	// Trinkets use an empty list for vacancy, matching their generated representation.
	if (value === undefined) {
		if (slot === "trinketItem") farmer.trinketItem = [];
		else delete farmer[slot];
		return;
	}
	if (value != null && !isSavedItem(value))
		throw new Error("Unsupported equipment bundle");
	switch (slot) {
		case "hat":
			if (value == null || value.$type === "StardewValley.Objects.Hat") {
				farmer.hat = value;
				return;
			}
			break;
		case "boots":
			if (value == null || value.$type === "StardewValley.Objects.Boots") {
				farmer.boots = value;
				return;
			}
			break;
		case "leftRing":
		case "rightRing":
			if (
				value == null ||
				value.$type === "StardewValley.Objects.Ring" ||
				value.$type === "StardewValley.Objects.CombinedRing"
			) {
				farmer[slot] = value;
				return;
			}
			break;
		case "shirtItem":
		case "pantsItem":
			if (value == null || value.$type === "StardewValley.Objects.Clothing") {
				farmer[slot] = value;
				return;
			}
			break;
		case "trinketItem":
			if (value == null || value.$type === "StardewValley.Objects.Trinket") {
				farmer.trinketItem = value == null ? [] : [value];
				return;
			}
			break;
	}
	throw new Error("Equipment item does not match its saved slot type");
}

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
/** Positive serialized subtype checks avoid guessing equipment from names or generic IDs. */
export function canEquipItem(raw: InventoryValue, key: EquipmentSlot): boolean {
	if (emptySlot(raw)) return true;
	if (!isSavedItem(raw)) return false;
	const type = raw.$type;
	switch (key) {
		case "hat":
			return type === "StardewValley.Objects.Hat";
		case "boots":
			return type === "StardewValley.Objects.Boots";
		case "leftRing":
		case "rightRing":
			return (
				type === "StardewValley.Objects.Ring" ||
				type === "StardewValley.Objects.CombinedRing"
			);
		case "trinketItem":
			return type === "StardewValley.Objects.Trinket";
		// Clothing uses the saved variant, not the ambiguous numeric item ID: shirts
		// and pants can share catalog IDs and must never be accepted interchangeably.
		case "shirtItem":
			return (
				type === "StardewValley.Objects.Clothing" && raw.clothesType === "SHIRT"
			);
		case "pantsItem":
			return (
				type === "StardewValley.Objects.Clothing" && raw.clothesType === "PANTS"
			);
	}
}
/** Unlock state uses decoded statistics without changing equipment or filling defaults. */
export function trinketAvailable(farmer: Farmer | undefined): boolean {
	if (farmer === undefined) return false;
	if (!emptySlot(readEquipmentSlot(farmer, "trinketItem"))) return true;
	return (farmer.stats?.Values ?? []).some(
		(entry) => entry.key.toLowerCase() === "trinketslots" && entry.value > 0,
	);
}
