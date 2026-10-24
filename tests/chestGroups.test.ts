import { describe, expect, it } from "vitest";
import { chestColor, chestGroup } from "$lib/chestGroups";
import { Raw } from "$lib/proxies";
import type { ChestMetadata, ChestProxy } from "$lib/proxies/Chest.svelte";

const chest = (
	metadata: Partial<ChestMetadata>,
	raw: Record<string, unknown> = {},
) =>
	({
		[Raw]: { name: "Chest", ...raw },
		metadata: {
			id: "x",
			label: "x",
			kind: "chest",
			location: "Farm",
			...metadata,
		},
	}) as unknown as ChestProxy;

describe("chest groups", () => {
	it("sorts chests, fridges and the island apart", () => {
		expect(chestGroup(chest({ location: "Farm" }))).toBe("chests");
		expect(chestGroup(chest({ location: "IslandWest" }))).toBe("island-chests");
		expect(chestGroup(chest({ kind: "fridge", location: "FarmHouse" }))).toBe(
			"farmhouse-fridges",
		);
		expect(
			chestGroup(chest({ kind: "fridge", location: "IslandFarmHouse" })),
		).toBe("island-fridges");
	});

	it("keeps cabin fridges out of the farmhouse group", () => {
		// Cabin interiors are named FarmHouse<id>
		expect(
			chestGroup(
				chest({
					kind: "fridge",
					location: "FarmHouse41bff8c3",
					building: "Cabin",
				}),
			),
		).toBe("farm-fridges");
	});

	it("treats Mini-Fridges as fridges wherever they are", () => {
		expect(
			chestGroup(
				chest({ location: "Shed" }, { name: "Mini-Fridge", fridge: true }),
			),
		).toBe("farm-fridges");
		expect(
			chestGroup(chest({ location: "FarmHouse" }, { name: "Mini-Fridge" })),
		).toBe("farmhouse-fridges");
		expect(
			chestGroup(chest({ location: "IslandWest" }, { fridge: true })),
		).toBe("island-fridges");
	});

	it("reads the colour picked in-game, ignoring the black 'no colour'", () => {
		expect(
			chestColor(chest({}, { playerChoiceColor: { R: 143, G: 0, B: 255 } }))
				?.css,
		).toBe("rgb(143 0 255)");
		expect(
			chestColor(chest({}, { playerChoiceColor: { R: 0, G: 0, B: 0 } })),
		).toBeUndefined();
		expect(chestColor(chest({}))).toBeUndefined();
	});
});
