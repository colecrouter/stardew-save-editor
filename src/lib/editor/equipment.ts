import {
	emptySlot,
	farmers,
	MutationError,
	type Farmer,
	type Mutation,
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
export const equipmentLabels: Record<EquipmentSlot, string> = {
	hat: "Hat",
	leftRing: "Left ring",
	rightRing: "Right ring",
	boots: "Boots",
	shirtItem: "Shirt",
	pantsItem: "Pants",
	trinketItem: "Trinket",
};
export interface EquipmentSlotView {
	entityId: string;
	key: EquipmentSlot;
	label: string;
	empty: boolean;
	locked: boolean;
	name: string;
	itemId: string;
	raw?: Record<string, unknown>;
	stack?: number;
	quality?: number;
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
/** Missing equipment is a session-only empty location, never an eager XML write. */
export function inventoryItem(
	farmer: Farmer,
	location: InventoryLocation,
): unknown {
	if (typeof location !== "number") {
		// Runtime callers may cross TypeScript's boundary; never let an arbitrary
		// farmer field masquerade as an equipment location.
		if (!equipmentSlots.includes(location))
			throw new MutationError("Unknown equipment slot");
		return (farmer as unknown as Record<string, unknown>)[location];
	}
	if (
		!Number.isInteger(location) ||
		location < 0 ||
		!Array.isArray(farmer.items?.Item) ||
		location >= farmer.items.Item.length
	)
		throw new MutationError("Slot is outside the backpack");
	return farmer.items.Item[location];
}
/** Apply an already validated atomic exchange, materializing nil only when needed. */
export function applyEquipmentSwap(
	document: SaveDocument,
	action: Extract<Mutation, { type: "equipment-swap" }>,
) {
	const from = inventoryOwner(document, action.farmerId),
		to = inventoryOwner(document, action.toFarmerId);
	if (!from || !to)
		throw new MutationError("Farmer ID must resolve exactly once");
	const source = inventoryItem(from, action.slot),
		destination = inventoryItem(to, action.toSlot);
	if (emptySlot(source))
		throw new MutationError("Choose a nonempty source item");
	if (from === to && action.slot === action.toSlot)
		return { label: "Move item", review: "compact" as const };
	// Validate both records before writing either endpoint. In particular, swapping
	// an equipped hat onto an occupied backpack slot must also fit its displaced item.
	for (const [farmer, key, item] of [
		[to, action.toSlot, source],
		[from, action.slot, destination],
	] as const) {
		if (typeof key === "number") continue;
		if (!canEquipItem(item, key))
			throw new MutationError(
				`This item cannot go in the ${equipmentLabels[key].toLowerCase()} slot.`,
			);
		if (key === "trinketItem" && !emptySlot(item) && !trinketAvailable(farmer))
			throw new MutationError("The trinket slot is locked for this farmer.");
	}
	const write = (farmer: Farmer, key: InventoryLocation, value: unknown) => {
		// A missing equipment field has no transferable XML record. If it receives an
		// item, the vacated backpack uses a normal nil; history restores absence on Undo.
		const saved = value === undefined ? { "@_xsi:nil": "true" } : value;
		if (typeof key === "number") farmer.items.Item[key] = saved;
		else (farmer as unknown as Record<string, unknown>)[key] = saved;
	};
	write(from, action.slot, destination);
	write(to, action.toSlot, source);
	const label = (key: InventoryLocation) =>
		typeof key === "number"
			? `slot ${key + 1}`
			: equipmentLabels[key].toLowerCase();
	return {
		label: `${emptySlot(destination) ? "Move" : "Swap"} item from ${from.name}’s ${label(action.slot)} to ${to.name}’s ${label(action.toSlot)}`,
		review: "standalone" as const,
	};
}
