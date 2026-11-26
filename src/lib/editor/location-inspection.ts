import { chestOwnerId, placedObjectPath } from "./chest-storage.ts";
import type { Location, SaveDocument } from "./domain.ts";
import { type ItemVisual, readItemVisual } from "./item-presentation.ts";
import {
	describeFarmBuilding,
	type FarmBuildingMarker,
} from "./location-building-move.ts";
import {
	farmFurnitureBounds,
	type FarmOccupancy,
	isMovableChest,
	readFarmOccupancy,
} from "./location-placement.ts";
import { readRemovalTargets, type RemovalTarget } from "./location-removal.ts";
import { readFarmTerrain, type TerrainMarker } from "./location-terrain.ts";
import { isKnownLocation, savedType } from "./saved-types.ts";

// Match the vanilla farm IDs to their exported map names. Meadowlands uses
// the named additional-farm ID in the save, alongside the older numeric IDs.
const vanillaFarmMaps = {
	"0": "Farm",
	"1": "Farm_Fishing",
	"2": "Farm_Foraging",
	"3": "Farm_Mining",
	"4": "Farm_Combat",
	"5": "Farm_FourCorners",
	"6": "Farm_Island",
	MeadowlandsFarm: "Farm_Ranching",
} as const;

/** Workspace map exports supported by the read-only viewport. */
export type FarmMap = (typeof vanillaFarmMaps)[keyof typeof vanillaFarmMaps];
const farmMapsByLayout: ReadonlyMap<string, FarmMap> = new Map(
	Object.entries(vanillaFarmMaps),
);

export interface LocationInspection {
	id: string;
	name: string;
	readable: boolean;
	farmMap?: FarmMap | undefined;
	farmLayout?: string | undefined;
	terrain?: readonly TerrainMarker[] | undefined;
	removalTargets?: readonly RemovalTarget[] | undefined;
	greenhouseRepaired?: boolean | undefined;
	furniture?:
		| readonly {
				index: number;
				name: string;
				x: number;
				y: number;
				width: number;
				height: number;
		  }[]
		| undefined;
	buildings?: readonly FarmBuildingMarker[] | undefined;
	farmOccupancy?: FarmOccupancy | undefined;
	objects: readonly {
		index: number;
		x?: number | undefined;
		y?: number | undefined;
		name: string;
		type: string;
		chestOwnerId?: string | undefined;
		movable?: boolean | undefined;
		visual?: ItemVisual | undefined;
	}[];
}

export function readLocations(document: SaveDocument): LocationInspection[] {
	const locations: LocationInspection[] = [];
	function visit(
		location: Location | null,
		id: string,
		path: string,
		parent?: string,
	) {
		// The path identifies one saved record even when interiors share map names.
		// Keep opaque locations in the list without attempting to decode their data.
		if (!isKnownLocation(location)) {
			locations.push({
				id,
				name:
					parent === undefined
						? "Unknown location"
						: `${parent} / Unknown interior`,
				readable: false,
				objects: [],
			});
			return;
		}
		const name = location.uniqueName ?? location.name ?? "Unnamed location";
		const label = parent === undefined ? name : `${parent} / ${name}`;
		// Farm records share their saved name across layouts. Use the save's
		// layout ID to select the export whose grid matches the saved tiles.
		const isFarm =
			parent === undefined &&
			location.$type === "StardewValley.Farm" &&
			location.name === "Farm";
		// Stardew defaults older saves without whichFarm to the Standard layout.
		const farmLayout = isFarm
			? (document.SaveGame.whichFarm ?? "0").trim()
			: undefined;
		const farmMap =
			farmLayout === undefined ? undefined : farmMapsByLayout.get(farmLayout);
		locations.push({
			id,
			name: label,
			farmMap,
			farmLayout,
			terrain:
				isFarm && farmMap !== undefined ? readFarmTerrain(location) : undefined,
			greenhouseRepaired: isFarm ? location.greenhouseUnlocked : undefined,
			// Use the same saved bounds as placement so furniture covers exactly
			// the tiles it reserves, including any change from rotation.
			furniture:
				isFarm && farmMap !== undefined
					? (location.furniture ?? []).flatMap((item, index) => {
							if (!item || item.$type === "$unknown") return [];
							const bounds = farmFurnitureBounds(item);
							return bounds
								? [
										{
											...bounds,
											index,
											name: item.name ?? item.itemId ?? "Furniture",
										},
									]
								: [];
						})
					: undefined,
			buildings:
				isFarm && farmMap !== undefined
					? (location.buildings ?? []).flatMap(
							(building, index) => describeFarmBuilding(building, index) ?? [],
						)
					: undefined,
			removalTargets:
				isFarm && farmMap !== undefined
					? readRemovalTargets(location)
					: undefined,
			farmOccupancy:
				isFarm && farmMap !== undefined
					? readFarmOccupancy(location)
					: undefined,
			readable: location.objects !== undefined,
			// The dictionary key supplies the saved tile coordinate. Keep missing
			// values visible as unknown rather than guessing from the object payload.
			objects: (location.objects ?? []).map(({ key, value }, index) => ({
				index,
				movable: farmMap !== undefined && isMovableChest(value),
				// A direct chest shares Storage's exact owner path. Labels and tiles
				// can be duplicated, so neither is suitable for opening an inventory.
				chestOwnerId:
					value.$type === "StardewValley.Objects.Chest"
						? chestOwnerId(placedObjectPath(path, index))
						: undefined,
				visual: farmMap === undefined ? undefined : readItemVisual(value),
				x: key.X,
				y: key.Y,
				name:
					value.$type === "$unknown"
						? "Unknown object"
						: (value.name ?? value.itemId ?? "Unnamed object"),
				type:
					value.$type === "$unknown"
						? "Unknown type"
						: (savedType(value) ?? "Object"),
			})),
		});
		for (const [index, building] of (location.buildings ?? []).entries()) {
			if (building && building.$type !== "$unknown" && building.indoors)
				visit(
					building.indoors,
					`${id}/${index}`,
					`${path}.buildings.${index}.indoors`,
					label,
				);
		}
	}
	for (const [index, location] of (document.SaveGame.locations ?? []).entries())
		visit(location, String(index), `locations.${index}`);
	return locations;
}
