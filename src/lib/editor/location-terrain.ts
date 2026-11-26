import type { readFarmOccupancy } from "./location-placement.ts";
import { record } from "./plain-data.ts";

type Farm = Parameters<typeof readFarmOccupancy>[0];
export interface TerrainMarker {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly kind:
		| "flooring"
		| "soil"
		| "grass"
		| "tree"
		| "fruit-tree"
		| "bush"
		| "clump"
		| "giant-crop"
		| "unknown";
	readonly label: string;
	readonly material?: string;
	readonly planted?: boolean;
	readonly hiddenSoil?: boolean;
}

// The game uses one, two, or three adjacent tiles for known bush sizes.
function bushWidth(size: number | undefined) {
	return size === 2 ? 3 : size === 1 || size === 4 ? 2 : 1;
}

/** Project saved terrain regardless of its editing or removal eligibility. */
export function readFarmTerrain(farm: Farm): TerrainMarker[] {
	const markers: TerrainMarker[] = [];
	function add(
		marker: Omit<TerrainMarker, "x" | "y" | "width" | "height">,
		x?: number,
		y?: number,
		width = 1,
		height = 1,
	) {
		// Missing coordinates stay unknown. Missing dimensions can still show
		// a single anchor marker without claiming a larger footprint.
		if (
			x === undefined ||
			y === undefined ||
			!Number.isInteger(x) ||
			!Number.isInteger(y)
		)
			return;
		markers.push({
			...marker,
			x,
			y,
			width: Number.isInteger(width) && width > 0 ? width : 1,
			height: Number.isInteger(height) && height > 0 ? height : 1,
		});
	}
	for (const [index, { key, value }] of (
		farm.terrainFeatures ?? []
	).entries()) {
		const id = `terrain:${index}`;
		switch (value.$type) {
			case "StardewValley.TerrainFeatures.Flooring":
				add(
					{
						id,
						kind: "flooring",
						label: "Flooring",
						...(value.whichFloor === undefined
							? {}
							: { material: value.whichFloor }),
					},
					key.X,
					key.Y,
				);
				break;
			case "StardewValley.TerrainFeatures.HoeDirt": {
				// State 2 suppresses the dirt art in Stardew even if a crop is present.
				const planted = value.crop != null;
				add(
					{
						id,
						kind: "soil",
						label: planted ? "Planted soil" : "Tilled soil",
						planted,
						hiddenSoil: value.state === 2,
					},
					key.X,
					key.Y,
				);
				break;
			}
			case "StardewValley.TerrainFeatures.Grass":
			case "StardewValley.TerrainFeatures.CosmeticPlant":
				add(
					{
						id,
						kind: "grass",
						label: value.$type.endsWith(".Grass") ? "Grass" : "Cosmetic plant",
					},
					key.X,
					key.Y,
				);
				break;
			case "StardewValley.TerrainFeatures.Tree":
				add(
					{
						id,
						kind: "tree",
						label: value.tapped === true ? "Tapped tree" : "Wild tree",
					},
					key.X,
					key.Y,
				);
				break;
			case "StardewValley.TerrainFeatures.FruitTree":
				add({ id, kind: "fruit-tree", label: "Fruit tree" }, key.X, key.Y);
				break;
			case "StardewValley.TerrainFeatures.Bush":
				add(
					{ id, kind: "bush", label: "Bush" },
					key.X,
					key.Y,
					bushWidth(value.size),
				);
				break;
			case "StardewValley.TerrainFeatures.GiantCrop":
			case "StardewValley.TerrainFeatures.ResourceClump": {
				const giant = value.$type === "StardewValley.TerrainFeatures.GiantCrop";
				add(
					{
						id,
						kind: giant ? "giant-crop" : "clump",
						label: giant ? "Giant crop" : "Large obstacle",
					},
					key.X,
					key.Y,
					value.width,
					value.height,
				);
				break;
			}
			case "$unknown":
				add({ id, kind: "unknown", label: "Unknown terrain" }, key.X, key.Y);
		}
	}
	for (const [index, clump] of (farm.resourceClumps ?? []).entries()) {
		if (!clump || clump.$type === "$unknown") continue;
		const giant = clump.$type === "StardewValley.TerrainFeatures.GiantCrop";
		add(
			{
				id: `clump:${index}`,
				kind: giant ? "giant-crop" : "clump",
				label: giant ? "Giant crop" : "Large obstacle",
			},
			clump.tile?.X,
			clump.tile?.Y,
			clump.width,
			clump.height,
		);
	}
	for (const [index, bush] of (farm.largeTerrainFeatures ?? []).entries()) {
		if (!bush || bush.$type === "$unknown") continue;
		add(
			{ id: `bush:${index}`, kind: "bush", label: "Bush" },
			bush.tilePosition?.X,
			bush.tilePosition?.Y,
			bushWidth(bush.size),
		);
	}
	return markers;
}

/** Read representative atlas corners for the dev preview's vanilla sheet. */
export async function loadFloorSwatches(signal: AbortSignal) {
	const response = await fetch("/content/Data/FloorsAndPaths.json", { signal });
	if (!response.ok) return new Map<string, { x: number; y: number }>();
	const data: unknown = await response.json();
	const swatches = new Map<string, { x: number; y: number }>();
	if (!record(data)) return swatches;
	for (const [id, value] of Object.entries(data)) {
		if (
			!record(value) ||
			value["Texture"] !== "TerrainFeatures\\Flooring" ||
			!record(value["Corner"])
		)
			continue;
		const { X: x, Y: y } = value["Corner"];
		// Only reference crops wholly inside the known 256px sheet.
		if (
			typeof x === "number" &&
			typeof y === "number" &&
			[x, y].every(
				(coordinate) =>
					Number.isInteger(coordinate) && coordinate >= 0 && coordinate <= 240,
			)
		)
			swatches.set(id, { x, y });
	}
	return swatches;
}
