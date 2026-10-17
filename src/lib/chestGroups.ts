import { Raw } from "$lib/proxies";
import type { ChestProxy } from "$lib/proxies/Chest.svelte";

export type ChestGroupId =
	| "chests"
	| "farm-fridges"
	| "farmhouse-fridges"
	| "island-chests"
	| "island-fridges";

export const ChestGroups: { id: ChestGroupId; name: string }[] = [
	{ id: "chests", name: "Chests" },
	{ id: "farm-fridges", name: "Farm / Cabin Fridges" },
	{ id: "farmhouse-fridges", name: "Farm House Fridges" },
	{ id: "island-chests", name: "Island Chests" },
	{ id: "island-fridges", name: "Island Fridges" },
];

/** Kitchen fridges, and Mini-Fridges placed anywhere */
export const isFridge = (chest: ChestProxy) =>
	chest.metadata.kind === "fridge" ||
	chest[Raw].fridge === true ||
	/fridge/i.test(chest[Raw].name ?? "");

/** Ginger Island locations are all named Island* (IslandWest, IslandFarmHouse...) */
export const isIsland = (chest: ChestProxy) =>
	chest.metadata.location.startsWith("Island");

/** Which group of the chests page a chest is listed in */
export function chestGroup(chest: ChestProxy): ChestGroupId {
	const island = isIsland(chest);
	if (!isFridge(chest)) return island ? "island-chests" : "chests";
	if (island) return "island-fridges";
	// Cabin interiors are named FarmHouse<id>, so match the main house exactly
	return chest.metadata.location === "FarmHouse" && !chest.metadata.building
		? "farmhouse-fridges"
		: "farm-fridges";
}

/**
 * The colour picked for a chest in-game, as an `rgb()` string, or undefined
 * for an uncoloured chest (the game stores black for "no colour").
 */
export function chestColor(chest: ChestProxy) {
	const color = (chest[Raw] as { playerChoiceColor?: unknown })
		.playerChoiceColor as { R?: number; G?: number; B?: number } | undefined;
	if (!color) return undefined;
	const [r, g, b] = [color.R, color.G, color.B].map((c) => Number(c) || 0);
	if (r === 0 && g === 0 && b === 0) return undefined;
	return { css: `rgb(${r} ${g} ${b})`, r, g, b };
}
