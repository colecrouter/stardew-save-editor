import { savedType } from "./saved-types.ts";
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
/** Read-only destination policy shared by quest previews and reward authorization.
 * Prefer a compatible ordinary ticket stack; opaque empty markers never count as room. */
export function prizeTicketDestination(
	slots: readonly unknown[],
): { kind: "stack" | "empty"; slot: number } | undefined {
	const stackSlot = slots.findIndex(
		(item) =>
			record(item) &&
			savedType(item) === "Object" &&
			(item.quality === undefined || item.quality === 0) &&
			(item.orderData === undefined || item.orderData === "") &&
			(item.name === undefined || item.name === "Prize Ticket") &&
			!item.bigCraftable &&
			!item.specialItem &&
			String(item.itemId) === "PrizeTicket" &&
			typeof item.stack === "number" &&
			Number.isInteger(item.stack) &&
			item.stack > 0 &&
			item.stack < 999,
	);
	if (stackSlot >= 0) return { kind: "stack", slot: stackSlot };
	const slot = slots.indexOf(null);
	return slot < 0 ? undefined : { kind: "empty", slot };
}
