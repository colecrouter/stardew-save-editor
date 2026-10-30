import type { BackpackSlotView, BackpackView } from "../inventory-views.ts";
import type { EquipmentSlotView } from "../equipment.ts";

/** Local interaction targets share instance identity across numbered/equipment slots. */
export type InventorySlot = BackpackSlotView | EquipmentSlotView;

/** Inspect every location an owner's selected instance can occupy. */
export function allInventorySlots(owner: BackpackView): InventorySlot[] {
	return [...owner.slots, ...owner.equipment];
}
/** Named equipment locations expose a key and lock state instead of a numbered position. */
export function isEquipmentSlot(
	item: InventorySlot,
): item is EquipmentSlotView {
	return "key" in item;
}
