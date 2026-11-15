import type { InventorySlot } from "./inventory-values.ts";

/** Read-only destination policy shared by quest previews and reward authorization.
 * Prefer a compatible ordinary ticket stack; opaque empty markers never count as room. */
export function prizeTicketDestination(
	slots: readonly InventorySlot[],
): { kind: "stack" | "empty"; slot: number } | undefined {
	const stackSlot = slots.findIndex(
		(item) =>
			item?.$type === "StardewValley.Object" &&
			(item.quality === undefined || item.quality === 0) &&
			(item.orderData === undefined || item.orderData === "") &&
			(item.name === undefined || item.name === "Prize Ticket") &&
			!(item.bigCraftable === true) &&
			!(item.specialItem === true) &&
			item.itemId === "PrizeTicket" &&
			item.stack !== undefined &&
			item.stack > 0 &&
			item.stack < 999,
	);
	if (stackSlot >= 0) return { kind: "stack", slot: stackSlot };
	const slot = slots.indexOf(null);
	return slot < 0 ? undefined : { kind: "empty", slot };
}
