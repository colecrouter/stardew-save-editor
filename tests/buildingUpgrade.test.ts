import { describe, expect, it } from "vitest";
import { getBuildingUpgradeData } from "../codegen/buildingUpgrade";

// Abridged from the game's Data/Buildings.json
const bigCoop = {
	BuildingToUpgrade: "Coop",
	ValidOccupantTypes: ["Coop"],
	HumanDoor: { X: 1, Y: 2 },
	AnimalDoor: { X: 2, Y: 2, Width: 1, Height: 1 },
	IndoorItems: [
		{
			Id: "Default_Incubator",
			ItemId: "(BC)101",
			Tile: { X: 2, Y: 3 },
			Indestructible: true,
			ClearTile: true,
		},
	],
	IndoorItemMoves: [
		{
			Id: "Default_ClearSpot_EggIncubator",
			Source: { X: 2, Y: 3 },
			Destination: { X: 14, Y: 8 },
			Size: { X: 1, Y: 1 },
			UnlessItemId: "(BC)101",
		},
		{
			Id: "Default_KeepAlongWall",
			Source: { X: 16, Y: 4 },
			Destination: { X: 20, Y: 4 },
			Size: { X: 1, Y: 9 },
			UnlessItemId: null,
		},
	],
	AddMailOnBuild: ["incubator"],
};

describe("building upgrade data", () => {
	it("maps the fields an upgrade uses", () => {
		expect(getBuildingUpgradeData(bigCoop)).toEqual({
			buildingToUpgrade: "Coop",
			validOccupantTypes: ["Coop"],
			humanDoor: { X: 1, Y: 2 },
			animalDoor: { X: 2, Y: 2 },
			indoorItems: [
				{
					id: "Default_Incubator",
					itemId: "(BC)101",
					tile: { X: 2, Y: 3 },
					indestructible: true,
				},
			],
			indoorItemMoves: [
				{
					source: { X: 2, Y: 3 },
					destination: { X: 14, Y: 8 },
					unlessItemId: "(BC)101",
				},
				{
					source: { X: 16, Y: 4 },
					destination: { X: 20, Y: 4 },
					size: { X: 1, Y: 9 },
				},
			],
			addMailOnBuild: ["incubator"],
		});
	});

	it("leaves out what a building doesn't have", () => {
		const data = getBuildingUpgradeData({
			BuildingToUpgrade: null,
			ValidOccupantTypes: [],
			HumanDoor: { X: -1, Y: -1 },
			AnimalDoor: { X: -1, Y: -1 },
			IndoorItems: null,
			IndoorItemMoves: null,
			AddMailOnBuild: null,
		});
		expect(JSON.parse(JSON.stringify(data))).toEqual({});
	});
});
