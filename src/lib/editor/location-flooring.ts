import { Result } from "effect";

import type { SaveDocument } from "./domain.ts";
import type { MapTile } from "./location-interaction.ts";
import type { LocationMap } from "./location-map.ts";
import {
	type FarmOccupancy,
	farmOccupancyProblem,
	readFarmOccupancy,
} from "./location-placement.ts";
import type { TileArea } from "./location-removal.ts";
import type { TerrainMarker } from "./location-terrain.ts";
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

export type FlooringFillMode = "area" | "perimeter";

export type FlooringPlacementMode =
	| { readonly kind: "empty" }
	| { readonly kind: "overwrite" }
	| { readonly kind: "replace"; readonly from: readonly string[] };

export interface FlooringPlacementTile extends MapTile {
	/** The expected material on a replacement tile. Additions omit it. */
	readonly previous?: string;
}

export interface PlaceFarmFlooring {
	readonly type: "farm-flooring-place";
	readonly locationIndex: number;
	readonly material: string;
	/** Exact editable tiles displayed in the preview at the expected revision. */
	readonly tiles: readonly FlooringPlacementTile[];
}

function inPattern(
	x: number,
	y: number,
	bounds: TileArea,
	mode: FlooringFillMode,
) {
	return (
		mode === "area" ||
		x === bounds.left ||
		x === bounds.right ||
		y === bounds.top ||
		y === bounds.bottom
	);
}

/** Resolve a saved material ID to its vanilla display name when available. */
export function flooringMaterialName(id: string | undefined) {
	return id === undefined ? undefined : names.get(id);
}

/** Find the flooring records eligible for choice in the selected area. */
function flooringInScope(
	terrain: readonly TerrainMarker[],
	scope: TileArea | "farm",
	pattern: FlooringFillMode,
) {
	return terrain.filter(
		({ kind, x, y }) =>
			kind === "flooring" &&
			(scope === "farm" ||
				(x >= scope.left &&
					x <= scope.right &&
					y >= scope.top &&
					y <= scope.bottom &&
					inPattern(x, y, scope, pattern))),
	);
}

/** Count each selectable source material within the current scope. */
export function flooringSourceChoices(
	terrain: readonly TerrainMarker[],
	scope: TileArea | "farm",
	pattern: FlooringFillMode,
) {
	return flooringMaterialChoices(
		flooringInScope(terrain, scope, pattern).map(({ material }) => material),
	);
}

/** Turn saved material IDs into a stable palette with counts. */
export function flooringMaterialChoices(
	materials: readonly (string | undefined)[],
) {
	const counts = new Map<string, number>();
	for (const material of materials) {
		if (material !== undefined)
			counts.set(material, (counts.get(material) ?? 0) + 1);
	}
	// Keep catalog order stable as the selection grows or shrinks.
	return flooringMaterials.flatMap((material) => {
		const count = counts.get(material.id);
		return count === undefined ? [] : [{ ...material, count }];
	});
}

/** Preview additions and replacements together, using one placement pattern. */
export function planFlooringPlacement(
	map: Pick<LocationMap, "width" | "height" | "placement">,
	occupancy: FarmOccupancy,
	terrain: readonly TerrainMarker[],
	scope: TileArea | "farm",
	material: string,
	mode: FlooringPlacementMode,
	pattern: FlooringFillMode = "area",
) {
	const tiles: FlooringPlacementTile[] = [];
	let blocked = 0;
	if (
		!names.has(material) ||
		occupancy.incomplete ||
		(mode.kind === "replace" && mode.from.length === 0)
	)
		return { tiles, blocked };

	const bounds =
		scope === "farm"
			? { left: 0, top: 0, right: map.width - 1, bottom: map.height - 1 }
			: scope;
	const flooring = new Map(
		flooringInScope(terrain, bounds, pattern).map((tile) => [
			`${tile.x},${tile.y}`,
			tile,
		]),
	);

	for (
		let y = Math.max(0, bounds.top);
		y <= Math.min(map.height - 1, bounds.bottom);
		y++
	) {
		for (
			let x = Math.max(0, bounds.left);
			x <= Math.min(map.width - 1, bounds.right);
			x++
		) {
			if (!inPattern(x, y, bounds, pattern)) continue;
			const floor = flooring.get(`${x},${y}`);
			const previous = floor?.material;
			// A source filter limits Replace only to matching floors. The
			// destination material already in place needs no edit in any mode.
			if (
				(mode.kind === "replace" &&
					(previous === undefined || !mode.from.includes(previous))) ||
				previous === material
			)
				continue;
			const replace =
				previous !== undefined && names.has(previous) && mode.kind !== "empty";
			const add = floor === undefined && map.placement.has(y * map.width + x);
			// Existing floors may change where they are already laid. Other
			// saved occupants still block placement, even over flooring.
			if (
				(!add && !replace) ||
				farmOccupancyProblem(occupancy, { x, y }, undefined, replace) !==
					undefined
			) {
				blocked++;
				continue;
			}
			tiles.push(replace ? { x, y, previous } : { x, y });
		}
	}
	return { tiles, blocked };
}

export function applyFarmFlooringPlacement(
	document: SaveDocument,
	action: PlaceFarmFlooring,
) {
	const farm = document.SaveGame.locations?.[action.locationIndex];
	if (farm?.$type !== "StardewValley.Farm" || farm.name !== "Farm")
		return Result.fail(
			new MutationError("The selected farm is no longer available."),
		);
	if (!names.has(action.material) || action.tiles.length === 0)
		return Result.fail(new MutationError("No eligible flooring tiles."));

	const occupancy = readFarmOccupancy(farm);
	const savedTiles = new Map(
		(farm.terrainFeatures ?? []).map(({ key, value }) => [
			`${key.X},${key.Y}`,
			value,
		]),
	);
	const keys = new Set<string>();
	// Recheck all targets before writing. An occupied addition or changed
	// replacement rejects the entire edit instead of applying only part of it.
	for (const tile of action.tiles) {
		const key = `${tile.x},${tile.y}`;
		if (
			![tile.x, tile.y].every(
				(value) => Number.isInteger(value) && value >= 0 && value < 110,
			) ||
			keys.has(key)
		)
			return Result.fail(
				new MutationError("The flooring preview contains an invalid tile."),
			);
		const existing = savedTiles.get(key);
		const replace = tile.previous !== undefined;
		if (
			replace
				? !names.has(tile.previous) ||
					tile.previous === action.material ||
					existing?.$type !== "StardewValley.TerrainFeatures.Flooring" ||
					existing.whichFloor !== tile.previous
				: existing !== undefined
		)
			return Result.fail(
				new MutationError("The flooring at a previewed tile has changed."),
			);
		const problem = farmOccupancyProblem(occupancy, tile, undefined, replace);
		if (problem !== undefined) return Result.fail(new MutationError(problem));
		keys.add(key);
	}

	// Update existing records in place to preserve their variants and metadata.
	// Only additions create a dictionary entry and start with the default variant.
	const terrain = (farm.terrainFeatures ??= []);
	for (const { x, y } of action.tiles) {
		const existing = savedTiles.get(`${x},${y}`);
		if (existing?.$type === "StardewValley.TerrainFeatures.Flooring")
			existing.whichFloor = action.material;
		else
			terrain.push({
				key: { X: x, Y: y },
				value: {
					$type: "StardewValley.TerrainFeatures.Flooring",
					whichFloor: action.material,
					whichView: 0,
				},
			});
	}
	return Result.succeed({
		label: `Place flooring on ${action.tiles.length} ${action.tiles.length === 1 ? "tile" : "tiles"}`,
		review: "standalone" as const,
	});
}
