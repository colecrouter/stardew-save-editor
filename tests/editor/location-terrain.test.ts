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
