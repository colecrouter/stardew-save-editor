import {
	farmers as savedFarmers,
	type Farmer,
	type SaveDocument,
} from "./domain.ts";
import {
	discoverPlacedChests,
	writeChestSlots,
	type PlacedChest,
} from "./chest-storage.ts";

/** A transient lens over an inventory; numbered slots are shared, equipment belongs to farmers. */
export interface InventoryContainer {
	id: string;
	name: string;
	kind: "farmer" | "chest";
	slots: unknown[];
	farmer?: Farmer;
	/** Private storage lens, retained only while this adapter resolves a transition. */
	storage?: PlacedChest;
	write: (slots: unknown[]) => void;
}
/** Resolve owner IDs without coercing opaque imported identifiers or choosing between collisions. */
export function inventoryContainers(
	document: SaveDocument,
	ownerId?: string,
): InventoryContainer[] {
	const farmers = savedFarmers(document);
	// Count every present decoded identity, including farmers without backpacks,
	// so an incomplete farmer cannot hide a collision with a storage owner.
	const scalarIds = farmers.flatMap((farmer) =>
		farmer.UniqueMultiplayerID === undefined
			? []
			: [farmer.UniqueMultiplayerID.toString()],
	);
	// Restrict expensive slot normalization during a targeted lookup. Keep all
	// farmer IDs in collision accounting: a chest can share a modded farmer ID.
	const chests = discoverPlacedChests(document, ownerId);
	const counts = new Map<string, number>();
	for (const id of [...scalarIds, ...chests.map((chest) => chest.id)])
		counts.set(id, (counts.get(id) ?? 0) + 1);
	const result: InventoryContainer[] = farmers.flatMap((farmer) => {
		const key = farmer.UniqueMultiplayerID;
		const slots = farmer.items;
		if (key === undefined || !Array.isArray(slots)) return [];
		return [
			{
				id: String(key),
				name: farmer.name ?? "Unnamed farmer",
				kind: "farmer" as const,
				slots,
				farmer,
				write: (slots: unknown[]) => {
					// The generic transition layer permutes decoded slots or inserts
					// codec-backed catalog items. Rejoin that typed representation
					// without decoding unrelated slots again or changing references.
					farmer.items = slots as NonNullable<Farmer["items"]>;
				},
			},
		];
	});
	for (const chest of chests) {
		if (!chest.supported) continue;
		result.push({
			id: chest.id,
			name: chest.label,
			kind: "chest",
			storage: chest,
			slots: chest.slots,
			// The writer compacts only null slots and preserves all stored item records.
			write: (slots) => writeChestSlots(chest, slots),
		});
	}
	// A namespaced chest ID is still only a scalar string. A modded farmer may use
	// that exact value, so ambiguity invalidates both instead of choosing by prefix.
	return result.filter(
		(owner) =>
			counts.get(owner.id) === 1 &&
			(ownerId === undefined || owner.id === ownerId),
	);
}
export function resolveInventoryContainer(
	document: SaveDocument,
	id: string,
): InventoryContainer | undefined {
	return inventoryContainers(document, id).find((owner) => owner.id === id);
}
