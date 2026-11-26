import { Result } from "effect";

import type { SaveDocument } from "./domain.ts";
import type { MapTile } from "./location-interaction.ts";
import {
	farmOccupancyProblem,
	readFarmOccupancy,
} from "./location-placement.ts";
import { MutationError } from "./mutation-error.ts";

type Farm = Parameters<typeof readFarmOccupancy>[0];
type Building = NonNullable<NonNullable<Farm["buildings"]>[number]>;

export interface FarmBuildingMarker extends MapTile {
	readonly index: number;
	readonly name: string;
	readonly width: number;
	readonly height: number;
	readonly doors?: readonly MapTile[] | undefined;
	readonly moveReason?: string | undefined;
}

const coopTiers = new Set(["Coop", "Big Coop", "Deluxe Coop"]);

/** Read the saved footprint and expose move support only for vanilla coops. */
export function describeFarmBuilding(
	building: Building | null,
	index: number,
): FarmBuildingMarker | undefined {
	if (!building || building.$type === "$unknown") return undefined;
	const { tileX: x, tileY: y, tilesWide: width, tilesHigh: height } = building;
	if (
		x === undefined ||
		y === undefined ||
		width === undefined ||
		height === undefined ||
		![x, y, width, height].every(Number.isInteger) ||
		width < 1 ||
		height < 1
	)
		return undefined;

	// Vanilla saves use the base Building for current coops and can retain
	// the older Coop subtype. These tiers share the footprint, doors and instanced
	// AnimalHouse contract. Other buildings can still be selected and inspected.
	let moveReason: string | undefined;
	if (
		(building.$type !== "StardewValley.Buildings.Building" &&
			building.$type !== "StardewValley.Buildings.Coop") ||
		building.buildingType === undefined ||
		!coopTiers.has(building.buildingType)
	)
		moveReason = "Building moves currently support vanilla coops.";
	else if (
		(building.daysOfConstructionLeft ?? 0) !== 0 ||
		(building.daysUntilUpgrade ?? 0) !== 0
	)
		moveReason = "Finish construction or upgrading before moving this coop.";
	else if (
		building.indoors?.$type !== "StardewValley.AnimalHouse" ||
		(building.indoors.uniqueName?.trim() ?? "") === ""
	)
		moveReason = "This coop’s interior could not be verified.";
	else if (
		width !== 6 ||
		height !== 3 ||
		building.humanDoor?.X !== 1 ||
		building.humanDoor.Y !== 2 ||
		building.animalDoor?.X !== 2 ||
		building.animalDoor.Y !== 2
	)
		moveReason = "This coop has an unsupported footprint or door layout.";
	else if ((building.modData?.length ?? 0) !== 0)
		moveReason = "This coop has mod data that the move cannot verify.";

	const doors =
		moveReason === undefined
			? [
					{ x: 1, y: 3 },
					{ x: 2, y: 3 },
				]
			: undefined;
	return {
		index,
		name: building.buildingType ?? "Building",
		x,
		y,
		width,
		height,
		doors,
		moveReason,
	};
}

/** Enumerate the footprint and the approach tiles directly below both doors. */
export function buildingDestinationTiles(
	building: FarmBuildingMarker,
	anchor: MapTile,
) {
	const tiles: (MapTile & { door: boolean })[] = [];
	for (let y = 0; y < building.height; y++)
		for (let x = 0; x < building.width; x++)
			tiles.push({ x: anchor.x + x, y: anchor.y + y, door: false });
	for (const door of building.doors ?? [])
		tiles.push({ x: anchor.x + door.x, y: anchor.y + door.y, door: true });
	return tiles;
}

export interface MoveFarmCoop {
	readonly type: "farm-coop-move";
	readonly locationIndex: number;
	readonly buildingIndex: number;
	readonly source: MapTile;
	readonly destination: MapTile;
}

export function applyFarmCoopMove(
	document: SaveDocument,
	action: MoveFarmCoop,
) {
	const farm = document.SaveGame.locations?.[action.locationIndex];
	if (farm?.$type !== "StardewValley.Farm" || farm.name !== "Farm")
		return Result.fail(
			new MutationError("The selected farm is no longer available."),
		);
	const building = farm.buildings?.[action.buildingIndex];
	const marker = building
		? describeFarmBuilding(building, action.buildingIndex)
		: undefined;
	if (
		!building ||
		building.$type === "$unknown" ||
		!marker?.doors ||
		marker.x !== action.source.x ||
		marker.y !== action.source.y
	)
		return Result.fail(
			new MutationError("The selected coop is no longer available to move."),
		);
	// Repeat the saved occupancy checks at the queued revision. The viewport
	// separately checks the exported map's buildable and passable terrain.
	const occupancy = readFarmOccupancy(farm, action.buildingIndex);
	for (const tile of buildingDestinationTiles(marker, action.destination)) {
		if (
			![tile.x, tile.y].every(
				(value) => Number.isInteger(value) && value >= 0 && value < 110,
			)
		)
			return Result.fail(
				new MutationError("The coop and both doors must fit on the farm."),
			);
		const problem = farmOccupancyProblem(occupancy, tile, undefined, tile.door);
		if (problem !== undefined) return Result.fail(new MutationError(problem));
	}
	// The game reconstructs interior warps and animal home references from the
	// placed building and the same interior on load. Preserve that interior
	// and its resident IDs, storage paths, and contents by moving only the anchor.
	building.tileX = action.destination.x;
	building.tileY = action.destination.y;
	return Result.succeed({
		label: `Move ${marker.name}`,
		review: "standalone" as const,
	});
}
