import { Result } from "effect";

import type { SaveDocument } from "./domain.ts";
import type { MapTile } from "./location-interaction.ts";
import { MutationError } from "./mutation-error.ts";

type Farm = Extract<
	NonNullable<NonNullable<SaveDocument["SaveGame"]["locations"]>[number]>,
	{ $type: "StardewValley.Farm" }
>;

type SavedObject = NonNullable<Farm["objects"]>[number]["value"];
type Chest = Extract<SavedObject, { $type: "StardewValley.Objects.Chest" }>;

/** This first save edit supports local, ordinary player chests. */
export function isMovableChest(value: SavedObject): value is Chest {
	return (
		value.$type === "StardewValley.Objects.Chest" &&
		value.itemId === "130" &&
		value.playerChest === true &&
		value.fridge !== true &&
		value.giftbox !== true &&
		(value.specialChestType === undefined ||
			value.specialChestType === "None") &&
		(value.globalInventoryId == null || value.globalInventoryId === "") &&
		(value.modData?.length ?? 0) === 0
	);
}

/** Rectangles in saved tiles. Missing bounds prevent placement for this farm. */
export interface FarmOccupancy {
	readonly blocked: readonly {
		x: number;
		y: number;
		width: number;
		height: number;
	}[];
	readonly incomplete: boolean;
}

export function readFarmOccupancy(farm: Farm): FarmOccupancy {
	const blocked: { x: number; y: number; width: number; height: number }[] = [];
	let incomplete = false;

	// Reserve saved footprints even where the base map shows bare ground.
	function reserve(x?: number, y?: number, width = 1, height = 1) {
		if (
			x === undefined ||
			y === undefined ||
			![x, y, width, height].every(Number.isInteger) ||
			width <= 0 ||
			height <= 0
		) {
			incomplete = true;
			return;
		}
		blocked.push({ x, y, width, height });
	}

	for (const { key } of farm.objects ?? []) reserve(key.X, key.Y);
	for (const { key } of farm.terrainFeatures ?? []) reserve(key.X, key.Y);
	for (const building of farm.buildings ?? []) {
		if (building === null) continue;
		if (
			building.$type === "$unknown" ||
			building.tilesWide === undefined ||
			building.tilesHigh === undefined
		)
			incomplete = true;
		else
			reserve(
				building.tileX,
				building.tileY,
				building.tilesWide,
				building.tilesHigh,
			);
	}
	for (const clump of farm.resourceClumps ?? []) {
		if (clump === null) continue;
		if (
			clump.$type === "$unknown" ||
			clump.width === undefined ||
			clump.height === undefined
		)
			incomplete = true;
		else reserve(clump.tile?.X, clump.tile?.Y, clump.width, clump.height);
	}
	for (const bush of farm.largeTerrainFeatures ?? []) {
		if (bush === null) continue;
		if (bush.$type === "$unknown") incomplete = true;
		// Reserve the maximum vanilla bush width so a placement cannot overlap
		// its footprint even where seasonal and size rules change the collision.
		else reserve(bush.tilePosition?.X, bush.tilePosition?.Y, 4);
	}
	for (const furniture of farm.furniture ?? []) {
		if (furniture === null) continue;
		if (furniture.$type === "$unknown") {
			incomplete = true;
			continue;
		}
		const box = furniture.boundingBox;
		// Furniture bounds are in game pixels. Round outward to touched tiles.
		if (
			box?.X === undefined ||
			box.Y === undefined ||
			box.Width === undefined ||
			box.Height === undefined
		) {
			incomplete = true;
			continue;
		}
		const x = Math.floor(box.X / 64);
		const y = Math.floor(box.Y / 64);
		reserve(
			x,
			y,
			Math.ceil((box.X + box.Width) / 64) - x,
			Math.ceil((box.Y + box.Height) / 64) - y,
		);
	}
	return { blocked, incomplete };
}

export function farmOccupancyProblem(occupancy: FarmOccupancy, tile: MapTile) {
	if (occupancy.incomplete)
		return "Some saved objects have unknown footprints.";
	if (
		occupancy.blocked.some(
			({ x, y, width, height }) =>
				tile.x >= x && tile.y >= y && tile.x < x + width && tile.y < y + height,
		)
	)
		return "That tile is occupied.";
	return undefined;
}

export interface MoveFarmChest {
	readonly type: "farm-chest-move";
	readonly locationIndex: number;
	readonly objectIndex: number;
	readonly source: MapTile;
	readonly destination: MapTile;
}

/** Prepare only a placed chest's geometry, retaining the owner and item handles. */
export function applyFarmChestMove(
	document: SaveDocument,
	{ locationIndex, objectIndex, source, destination }: MoveFarmChest,
) {
	const farm = document.SaveGame.locations?.[locationIndex];
	if (farm?.$type !== "StardewValley.Farm" || farm.name !== "Farm")
		return Result.fail(
			new MutationError("The selected farm is no longer available."),
		);

	const entry = farm.objects?.[objectIndex];
	if (
		!entry ||
		!isMovableChest(entry.value) ||
		entry.key.X !== source.x ||
		entry.key.Y !== source.y
	)
		return Result.fail(
			new MutationError("The selected chest is no longer available."),
		);

	// The viewport checks the exported map. Recheck save-derived occupancy
	// inside the queued revision so another edit cannot claim the destination.
	if (
		![destination.x, destination.y].every(
			(value) => Number.isInteger(value) && value >= 0 && value < 110,
		)
	)
		return Result.fail(new MutationError("Choose a tile inside the farm."));
	const reason = farmOccupancyProblem(readFarmOccupancy(farm), destination);
	if (reason !== undefined) return Result.fail(new MutationError(reason));

	const value = entry.value;
	entry.key = { ...entry.key, X: destination.x, Y: destination.y };
	value.tileLocation = {
		...value.tileLocation,
		X: destination.x,
		Y: destination.y,
	};
	const x = destination.x * 64;
	const y = destination.y * 64;
	// Stardew recalculates all mirrors of a placed object's 64-pixel box when
	// its tile changes. Preserve any unrelated extension fields in the record.
	value.boundingBox = {
		...value.boundingBox,
		X: x,
		Y: y,
		Width: 64,
		Height: 64,
		Location: { ...value.boundingBox?.Location, X: x, Y: y },
		Size: { ...value.boundingBox?.Size, X: 64, Y: 64 },
	};

	return Result.succeed({
		label: "Move farm chest",
		review: "standalone" as const,
	});
}
