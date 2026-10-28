import type { Farmer, SaveDocument } from "./domain.ts";
import {
	discoverPlacedChests,
	writeChestSlots,
	emptyChestSlot,
} from "./chest-storage.ts";

/** A transient lens over an inventory; numbered slots are shared, equipment belongs to farmers. */
export interface InventoryContainer {
	id: string;
	name: string;
	kind: "farmer" | "chest";
	slots: unknown[];
	farmer?: Farmer;
	write: (slots: unknown[]) => void;
}
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
/** Resolve owner IDs without coercing opaque imported identifiers or choosing between collisions. */
export function inventoryContainers(
	document: SaveDocument,
): InventoryContainer[] {
	const game = document.SaveGame;
	const farmers = [
		game.player,
		...(game.farmhands === "" ? [] : game.farmhands.Farmer),
	];
	const scalarIds = farmers.flatMap((farmer) => {
		if (!record(farmer)) return [];
		const key = farmer.UniqueMultiplayerID;
		return typeof key === "string" ||
			(typeof key === "number" && Number.isFinite(key))
			? [String(key)]
			: [];
	});
	const chests = discoverPlacedChests(document);
	const counts = new Map<string, number>();
	for (const id of [...scalarIds, ...chests.map((chest) => chest.id)])
		counts.set(id, (counts.get(id) ?? 0) + 1);
	const result: InventoryContainer[] = farmers.flatMap((farmer) => {
		if (!record(farmer)) return [];
		const key = farmer.UniqueMultiplayerID;
		if (
			!(typeof key === "string" && key.length > 0) &&
			!(typeof key === "number" && Number.isFinite(key))
		)
			return [];
		if (!record(farmer.items) || !Array.isArray(farmer.items.Item)) return [];
		return [
			{
				id: String(key),
				name: farmer.name,
				kind: "farmer" as const,
				slots: farmer.items.Item,
				farmer,
				write: (slots: unknown[]) => {
					farmer.items.Item = slots;
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
			slots: chest.slots,
			// The writer rejects opaque nil markers rather than erasing their mod data
			// when a backpack/chest exchange would compact them out of the save.
			write: (slots) => writeChestSlots(chest, slots),
		});
	}
	// A namespaced chest ID is still only a scalar string. A modded farmer may use
	// that exact value, so ambiguity invalidates both instead of choosing by prefix.
	return result.filter((owner) => counts.get(owner.id) === 1);
}
export function resolveInventoryContainer(
	document: SaveDocument,
	id: string,
): InventoryContainer | undefined {
	return inventoryContainers(document).find((owner) => owner.id === id);
}
/** Structural chest changes compact empty slots; identities must follow the same permutation. */
export function compactChestIdentities(
	slots: readonly unknown[],
	ids: readonly string[],
): string[] {
	return [
		...ids.filter((_, index) => !emptyChestSlot(slots[index])),
		...ids.filter((_, index) => emptyChestSlot(slots[index])),
	];
}
