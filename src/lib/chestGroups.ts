import { Raw } from "$lib/proxies";
import type { ChestProxy } from "$lib/proxies/Chest.svelte";

import { isRecord } from "./unknown.ts";

export type ChestGroupId =
	| "chests"
	| "farm-fridges"
	| "farmhouse-fridges"
	| "island-chests"
	| "island-fridges";

export const ChestGroups = [
	{ id: "chests", name: "Chests" },
	{ id: "farm-fridges", name: "Farm / Cabin Fridges" },
	{ id: "farmhouse-fridges", name: "Farm House Fridges" },
	{ id: "island-chests", name: "Island Chests" },
	{ id: "island-fridges", name: "Island Fridges" },
] satisfies { id: ChestGroupId; name: string }[];

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
	return chest.metadata.location === "FarmHouse" &&
		(chest.metadata.building === undefined ||
			chest.metadata.building === null ||
			chest.metadata.building.length === 0)
		? "farmhouse-fridges"
		: "farm-fridges";
}

/**
 * The colour picked for a chest in-game, as an `rgb()` string, or undefined
 * for an uncoloured chest (the game stores black for "no colour").
 */
export function chestColor(chest: ChestProxy) {
	const raw: unknown = chest[Raw];
	const color: unknown = isRecord(raw) ? raw["playerChoiceColor"] : undefined;
	// Unknown/modded colour data must be a record before channels are converted.
	if (!isRecord(color)) return undefined;
	const channel = (value: unknown) => {
		const number = Number(value);
		// Match the legacy fallback for NaN and signed zero; preserve other values.
		return Number.isNaN(number) || number === 0 ? 0 : number;
	};
	const r = channel(color["R"]),
		g = channel(color["G"]),
		b = channel(color["B"]);
	if (r === 0 && g === 0 && b === 0) return undefined;
	return { css: `rgb(${r} ${g} ${b})`, r, g, b };
}
