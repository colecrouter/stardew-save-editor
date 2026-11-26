import { expect, it } from "vitest";

import { readFarmTerrain } from "../../src/lib/editor/location-terrain.ts";

it("projects saved terrain independently of which records Reclaim can remove", () => {
	const terrain = readFarmTerrain({
		$type: "StardewValley.Farm",
		terrainFeatures: [
			{
				key: { X: 7, Y: 14 },
				value: {
					$type: "StardewValley.TerrainFeatures.Flooring",
					whichFloor: "12",
				},
			},
			{
				key: { X: 8, Y: 14 },
				value: { $type: "StardewValley.TerrainFeatures.HoeDirt" },
			},
			{
				key: { X: 9, Y: 14 },
				value: {
					$type: "StardewValley.TerrainFeatures.HoeDirt",
					state: 2,
					crop: {},
				},
			},
			{
				key: { X: 10, Y: 14 },
				value: { $type: "StardewValley.TerrainFeatures.Tree", tapped: true },
			},
		],
	});
	expect(terrain).toMatchObject([
		{ kind: "flooring", material: "12", x: 7, y: 14 },
		{ kind: "soil", planted: false, hiddenSoil: false },
		{ kind: "soil", planted: true, hiddenSoil: true },
		{ kind: "tree", label: "Tapped tree" },
	]);
});

it("anchors tree art independently of the saved one-tile footprint", () => {
	const [wild, fruit] = readFarmTerrain({
		$type: "StardewValley.Farm",
		terrainFeatures: [
			{
				key: { X: 6, Y: 14 },
				value: {
					$type: "StardewValley.TerrainFeatures.Tree",
					treeType: "3",
					growthStage: 8,
				},
			},
			{
				key: { X: 29, Y: 51 },
				value: {
					$type: "StardewValley.TerrainFeatures.FruitTree",
					treeId: "629",
					growthStage: 4,
					flipped: true,
				},
			},
		],
	});
	expect(wild).toMatchObject({ x: 6, y: 14, width: 1, height: 1 });
	expect(wild?.frames?.[1]).toMatchObject({
		width: 48,
		offsetX: -1,
		offsetY: -5,
	});
	expect(fruit?.frames?.[1]).toMatchObject({
		sourceX: 192,
		sourceY: 80,
		flipped: true,
	});
});
