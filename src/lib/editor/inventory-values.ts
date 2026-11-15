import type { Farmer, Item } from "./domain.ts";

// Backpack/chest slots use the polymorphic Item contract. Concrete equipment
// fields make their discriminator optional in generated TypeScript, although the
// decoder supplies it. Keep those contracts rather than asserting a root Item.
type EquipmentItem =
	| NonNullable<
			Farmer[
				| "hat"
				| "boots"
				| "leftRing"
				| "rightRing"
				| "shirtItem"
				| "pantsItem"]
	  >
	| NonNullable<NonNullable<Farmer["trinketItem"]>[number]>;
export type SavedItem = Item | EquipmentItem;
export type KnownItem = Exclude<SavedItem, { readonly $type: "$unknown" }>;
export type InventorySlot = Item | null;

// A multi-trinket list is deliberately not collapsed to its first item. It can
// be presented as unsupported equipment but cannot move into a numbered slot.
export type InventoryValue =
	| SavedItem
	| null
	| undefined
	| NonNullable<Farmer["trinketItem"]>;
export function isSavedItem(value: InventoryValue): value is SavedItem {
	return value != null && !Array.isArray(value);
}
export function isKnownItem(value: InventoryValue): value is KnownItem {
	return isSavedItem(value) && value.$type !== "$unknown";
}
export function isInventorySlot(value: InventoryValue): value is InventorySlot {
	// A numbered slot needs the root discriminator. This rejects unsupported
	// equipment representations without cloning or decoding an existing record.
	return value === null || (isSavedItem(value) && value.$type !== undefined);
}
