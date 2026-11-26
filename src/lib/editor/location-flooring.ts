import { Result } from "effect";

import type { SaveDocument } from "./domain.ts";
import type { TileArea } from "./location-removal.ts";
import { readFarmTerrain, type TerrainMarker } from "./location-terrain.ts";
import { MutationError } from "./mutation-error.ts";

// Vanilla FloorsAndPaths IDs, named by their corresponding Objects items.
export const flooringMaterials = [
	{ id: "0", name: "Wood Floor" },
	{ id: "1", name: "Stone Floor" },
	{ id: "2", name: "Weathered Floor" },
	{ id: "3", name: "Crystal Floor" },
	{ id: "4", name: "Straw Floor" },
	{ id: "5", name: "Gravel Path" },
	{ id: "6", name: "Wood Path" },
	{ id: "7", name: "Crystal Path" },
	{ id: "8", name: "Cobblestone Path" },
	{ id: "9", name: "Stepping Stone Path" },
	{ id: "10", name: "Brick Floor" },
	{ id: "11", name: "Rustic Plank Floor" },
	{ id: "12", name: "Stone Walkway Floor" },
] as const;
const names: ReadonlyMap<string, string> = new Map(
	flooringMaterials.map(({ id, name }) => [id, name]),
);

export interface ReplaceFarmFlooring {
	readonly type: "farm-flooring-replace";
	readonly locationIndex: number;
	readonly scope: TileArea | "farm";
	readonly from: string;
	readonly to: string;
}

/** Resolve a saved material ID to its vanilla display name when available. */
export function flooringMaterialName(id: string | undefined) {
	return id === undefined ? undefined : names.get(id);
}

/** Find the flooring records eligible for choice in the selected area. */
function flooringInScope(
	terrain: readonly TerrainMarker[],
	scope: TileArea | "farm",
) {
	return terrain.filter(
		({ kind, x, y }) =>
			kind === "flooring" &&
			(scope === "farm" ||
				(x >= scope.left &&
					x <= scope.right &&
					y >= scope.top &&
					y <= scope.bottom)),
	);
}

/** Count each selectable source material within the current scope. */
export function flooringSourceChoices(
	terrain: readonly TerrainMarker[],
	scope: TileArea | "farm",
) {
	const counts = new Map<string, number>();
	for (const { material } of flooringInScope(terrain, scope)) {
		if (material !== undefined)
			counts.set(material, (counts.get(material) ?? 0) + 1);
	}
	// Keep catalog order stable as the selection grows or shrinks.
	return flooringMaterials.flatMap((material) => {
		const count = counts.get(material.id);
		return count === undefined ? [] : [{ ...material, count }];
	});
}

/** Use the same material and area match for the map preview and the queued edit. */
export function planFlooringReplacement(
	terrain: readonly TerrainMarker[],
	scope: TileArea | "farm",
	from: string,
	to: string,
) {
	if (from === to || !names.has(from) || !names.has(to)) return [];
	return flooringInScope(terrain, scope).filter(
		({ material }) => material === from,
	);
}

export function applyFarmFlooringReplacement(
	document: SaveDocument,
	action: ReplaceFarmFlooring,
) {
	const farm = document.SaveGame.locations?.[action.locationIndex];
	if (farm?.$type !== "StardewValley.Farm" || farm.name !== "Farm")
		return Result.fail(
			new MutationError("The selected farm is no longer available."),
		);

	// Replan on the queued save revision and keep the original dictionary
	// entries. Changing only the material preserves each tile's variant and metadata.
	const targets = planFlooringReplacement(
		readFarmTerrain(farm),
		action.scope,
		action.from,
		action.to,
	);
	if (targets.length === 0)
		return Result.fail(
			new MutationError("No flooring matches this replacement."),
		);
	const keys = new Set(targets.map(({ x, y }) => `${x},${y}`));
	for (const { key, value } of farm.terrainFeatures ?? []) {
		if (
			value.$type === "StardewValley.TerrainFeatures.Flooring" &&
			value.whichFloor === action.from &&
			keys.has(`${key.X},${key.Y}`)
		)
			value.whichFloor = action.to;
	}

	return Result.succeed({
		label: `Replace ${targets.length} flooring ${targets.length === 1 ? "tile" : "tiles"}`,
		review: "standalone" as const,
	});
}
