import { Schema } from "effect";
import { ValueSchema } from "../../../generated/save-format/save.ts";
import { savedType } from "./saved-types.ts";
import type { ItemPresentation } from "./item-presentation.ts";
import { emptySlot, type Farmer } from "./domain.ts";

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
	farmer: unknown,
	slot: EquipmentSlot,
): unknown {
	if (!record(farmer)) return undefined;
	const value = farmer[slot];
	return slot === "trinketItem" && Array.isArray(value) && value.length <= 1
		? (value[0] ?? null)
		: value;
}
export function writeEquipmentSlot(
	farmer: Farmer,
	slot: EquipmentSlot,
	value: unknown,
): void {
	// Equipment writes arrive from generic inventory transitions. Validate the
	// generated field here so an opaque value cannot become a known equipment type.
	const candidate =
		slot === "trinketItem"
			? { trinketItem: value == null ? [] : [value] }
			: { [slot]: value };
	const checked = Schema.decodeUnknownSync(ValueSchema)({
		player: candidate,
	}).player;
	if (!checked) throw new Error("Equipment validation lost its owner");
	switch (slot) {
		case "trinketItem":
			farmer.trinketItem = checked.trinketItem;
			break;
		case "hat":
			farmer.hat = checked.hat;
			break;
		case "boots":
			farmer.boots = checked.boots;
			break;
		case "leftRing":
			farmer.leftRing = checked.leftRing;
			break;
		case "rightRing":
			farmer.rightRing = checked.rightRing;
			break;
		case "shirtItem":
			farmer.shirtItem = checked.shirtItem;
			break;
		case "pantsItem":
			farmer.pantsItem = checked.pantsItem;
			break;
	}
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
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
/** Positive serialized subtype checks avoid guessing equipment from names or generic IDs. */
export function canEquipItem(raw: unknown, key: EquipmentSlot): boolean {
	if (emptySlot(raw)) return true;
	if (!record(raw)) return false;
	const type = savedType(raw);
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
	if (!emptySlot(readEquipmentSlot(farmer, "trinketItem"))) return true;
	const stats = record(farmer.stats) ? farmer.stats : undefined;
	const values = stats?.Values;
	return (
		Array.isArray(values) &&
		values.some((entry: unknown) => {
			if (!record(entry)) return false;
			return (
				typeof entry.key === "string" &&
				entry.key.toLowerCase() === "trinketslots" &&
				typeof entry.value === "number" &&
				entry.value > 0
			);
		})
	);
}
