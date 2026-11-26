import { Result } from "effect";

import { chestOwnerId, placedObjectPath } from "./chest-storage.ts";
import type { SaveDocument } from "./domain.ts";
import type { InventoryIdentityState } from "./inventory-transition.ts";
import { flooringMaterialName } from "./location-flooring.ts";
import type { MapTile } from "./location-interaction.ts";
import type { readFarmOccupancy } from "./location-placement.ts";
import { MutationError } from "./mutation-error.ts";

/** Selection bounds include both corner tiles. */
export interface TileArea {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}

export function areaBetween(first: MapTile, second: MapTile): TileArea {
	return {
		left: Math.min(first.x, second.x),
		top: Math.min(first.y, second.y),
		right: Math.max(first.x, second.x),
		bottom: Math.max(first.y, second.y),
	};
}

export const removalGroups = [
	{ id: "debris", label: "Debris and large obstacles" },
	{ id: "grass", label: "Grass" },
	{ id: "trees", label: "Untapped wild trees" },
	{ id: "flooring", label: "Flooring" },
] as const;

export type RemovalGroup = (typeof removalGroups)[number]["id"];
type Farm = Parameters<typeof readFarmOccupancy>[0];
type Collection = "objects" | "terrainFeatures" | "resourceClumps";

// IDs in the vanilla WildTrees data. A mod can add a tree using the same
// saved class, so the class alone is insufficient for a removal preset.
const vanillaWildTreeIds = new Set([
	"1",
	"2",
	"3",
	"6",
	"7",
	"8",
	"9",
	"10",
	"11",
	"12",
	"13",
]);

export interface RemovalTarget {
	readonly collection: Collection;
	readonly index: number;
	readonly group: RemovalGroup;
	readonly material?: string;
	readonly area: TileArea;
}

/** Project only records that can be removed without altering linked save data. */
export function readRemovalTargets(farm: Farm): RemovalTarget[] {
	const targets: RemovalTarget[] = [];
	function add(
		collection: Collection,
		index: number,
		group: RemovalGroup,
		x?: number,
		y?: number,
		width = 1,
		height = 1,
		material?: string,
	) {
		if (
			x === undefined ||
			y === undefined ||
			![x, y, width, height].every(Number.isInteger) ||
			width < 1 ||
			height < 1
		)
			return;
		targets.push({
			collection,
			index,
			group,
			...(material === undefined ? {} : { material }),
			area: { left: x, top: y, right: x + width - 1, bottom: y + height - 1 },
		});
	}

	const occupied = new Set<string>();
	for (const [index, { key, value }] of (farm.objects ?? []).entries()) {
		occupied.add(`${key.X},${key.Y}`);
		// The game's litter category distinguishes these names from resources,
		// forage, machines and storage. Preserve records with attached state.
		if (
			value.$type === "StardewValley.Object" &&
			value.category === -999 &&
			(value.name === "Stone" ||
				value.name === "Twig" ||
				value.name === "Weeds") &&
			value.heldObject == null &&
			(value.modData?.length ?? 0) === 0
		)
			add("objects", index, "debris", key.X, key.Y);
	}
	for (const [index, { key, value }] of (
		farm.terrainFeatures ?? []
	).entries()) {
		if (value.$type === "$unknown" || (value.modData?.length ?? 0) !== 0)
			continue;
		if (value.$type === "StardewValley.TerrainFeatures.Grass")
			add("terrainFeatures", index, "grass", key.X, key.Y);
		// Flooring has its own saved entry, so removing it can leave an object
		// on the same tile intact. Keep materials outside the vanilla catalog.
		if (
			value.$type === "StardewValley.TerrainFeatures.Flooring" &&
			flooringMaterialName(value.whichFloor) !== undefined
		)
			add(
				"terrainFeatures",
				index,
				"flooring",
				key.X,
				key.Y,
				1,
				1,
				value.whichFloor,
			);
		// Keep fruit trees, tapped trees and any tree sharing its tile with an object.
		if (
			value.$type === "StardewValley.TerrainFeatures.Tree" &&
			value.tapped !== true &&
			value.treeType !== undefined &&
			vanillaWildTreeIds.has(value.treeType) &&
			!occupied.has(`${key.X},${key.Y}`)
		)
			add("terrainFeatures", index, "trees", key.X, key.Y);
	}
	for (const [index, clump] of (farm.resourceClumps ?? []).entries()) {
		// Ordinary stumps, logs and boulders are distinct from giant crops.
		if (
			clump?.$type === "StardewValley.TerrainFeatures.ResourceClump" &&
			(clump.parentSheetIndex === 600 ||
				clump.parentSheetIndex === 602 ||
				clump.parentSheetIndex === 672) &&
			clump.width !== undefined &&
			clump.height !== undefined &&
			(clump.modData?.length ?? 0) === 0
		)
			add(
				"resourceClumps",
				index,
				"debris",
				clump.tile?.X,
				clump.tile?.Y,
				clump.width,
				clump.height,
			);
	}
	return targets;
}

/** Use the same footprint and category rules in the preview and queued command. */
export function planFarmRemoval(
	targets: readonly RemovalTarget[],
	scope: TileArea | "farm",
	groups: readonly RemovalGroup[],
	materials?: readonly string[],
) {
	return targets.filter(
		({ area, group, material }) =>
			groups.includes(group) &&
			(group !== "flooring" ||
				materials === undefined ||
				(material !== undefined && materials.includes(material))) &&
			(scope === "farm" ||
				(area.left >= scope.left &&
					area.top >= scope.top &&
					area.right <= scope.right &&
					area.bottom <= scope.bottom)),
	);
}

export interface RemoveFarmObstacles {
	readonly type: "farm-obstacles-remove";
	readonly locationIndex: number;
	readonly scope: TileArea | "farm";
	readonly groups: readonly RemovalGroup[];
	readonly materials?: readonly string[];
}

export function applyFarmRemoval(
	document: SaveDocument,
	action: RemoveFarmObstacles,
	inventory?: InventoryIdentityState,
) {
	const farm = document.SaveGame.locations?.[action.locationIndex];
	if (farm?.$type !== "StardewValley.Farm" || farm.name !== "Farm")
		return Result.fail(
			new MutationError("The selected farm is no longer available."),
		);

	const targets = planFarmRemoval(
		readRemovalTargets(farm),
		action.scope,
		action.groups,
		action.materials,
	);
	if (targets.length === 0)
		return Result.fail(
			new MutationError("Nothing removable matches this selection."),
		);
	const indices = (collection: Collection) =>
		new Set(
			targets
				.filter((target) => target.collection === collection)
				.map(({ index }) => index),
		);
	const removedObjects = indices("objects");
	if (farm.objects && removedObjects.size > 0) {
		const path = `locations.${action.locationIndex}`;
		const oldIds = inventory?.identities;
		const identities = oldIds ? { ...oldIds } : undefined;
		const remaining = farm.objects.filter(
			(_, index) => !removedObjects.has(index),
		);
		// Storage keys contain dictionary positions. First clear just the moved
		// keys, then copy each surviving handle from the original dictionary.
		if (identities && oldIds) {
			for (const index of farm.objects.keys()) {
				const objectPath = placedObjectPath(path, index);
				delete identities[chestOwnerId(objectPath)];
				delete identities[chestOwnerId(`${objectPath}.heldObject`)];
			}
			let next = 0;
			for (const index of farm.objects.keys()) {
				if (removedObjects.has(index)) continue;
				for (const suffix of ["", ".heldObject"]) {
					const before = chestOwnerId(placedObjectPath(path, index) + suffix);
					const after = chestOwnerId(placedObjectPath(path, next) + suffix);
					const ids = oldIds[before];
					if (ids) identities[after] = ids;
				}
				next++;
			}
			if (inventory) inventory = { ...inventory, identities };
		}
		farm.objects = remaining;
	}
	const removedTerrain = indices("terrainFeatures");
	if (farm.terrainFeatures && removedTerrain.size > 0)
		farm.terrainFeatures = farm.terrainFeatures.filter(
			(_, index) => !removedTerrain.has(index),
		);
	const removedClumps = indices("resourceClumps");
	if (farm.resourceClumps && removedClumps.size > 0)
		farm.resourceClumps = farm.resourceClumps.filter(
			(_, index) => !removedClumps.has(index),
		);

	return Result.succeed({
		label: targets.every(({ group }) => group === "flooring")
			? `Remove ${targets.length} flooring ${targets.length === 1 ? "tile" : "tiles"}`
			: targets.some(({ group }) => group === "flooring")
				? "Remove farm obstacles and flooring"
				: `Remove ${targets.length} farm obstacles`,
		review: "standalone" as const,
		inventory,
	});
}
