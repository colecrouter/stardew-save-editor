import { describe, expect, it } from "vitest";
import {
	discoverPlacedChests,
	writeChestSlots,
} from "../../src/lib/editor/chest-storage";
import { tinyFixture } from "./fixtures";

const item = (name = "Parsnip") => ({
	"@_xsi:type": "Object",
	name,
	itemId: "24",
	stack: 2,
	opaque: "007",
});
const chest = (fields: Record<string, unknown> = {}) => ({
	"@_xsi:type": "Chest",
	name: "Chest",
	items: "",
	...fields,
});
const placed = (raw: unknown, x = 3) => ({
	key: { Vector2: { X: x, Y: 9 } },
	value: { Object: raw },
});
function fixture(locations: unknown) {
	const document = tinyFixture();
	Object.assign(document.SaveGame, { locations: { GameLocation: locations } });
	return document;
}
const required = <A>(value: A | undefined): A => {
	if (value === undefined) throw Error("Missing fixture chest");
	return value;
};

describe("placed chest storage", () => {
	it("projects singleton locations and objects without materializing virtual empty slots", () => {
		const document = fixture({
			name: "Farm",
			objects: { item: placed(chest()) },
		});
		const original = structuredClone(document);
		const found = required(discoverPlacedChests(document)[0]);
		expect(found).toMatchObject({
			id: "chest:locations.0.objects.0",
			label: "Farm - Chest (3, 9)",
			capacity: 36,
			supported: true,
			serializedLength: 0,
		});
		expect(found.slots).toHaveLength(36);
		expect(document).toEqual(original);
	});

	it("discovers interiors, fridges, machine-held and building storage while retaining placed owner paths", () => {
		const document = fixture([
			{
				name: "Farm",
				fridge: chest(),
				buildings: {
					Building: {
						buildingType: "Shed",
						buildingChests: { Chest: chest() },
						indoors: {
							name: "Shed",
							objects: {
								item: [
									placed(
										chest({ itemId: "BigStoneChest", name: "Big Stone Chest" }),
									),
									placed({
										"@_xsi:type": "Object",
										heldObject: chest(),
										Chest: chest(),
									}),
								],
							},
						},
					},
				},
			},
		]);
		const found = discoverPlacedChests(document);
		expect(found).toHaveLength(5);
		expect(found.map((chest) => chest.source).sort()).toEqual([
			"building",
			"chest",
			"fridge",
			"machine",
			"machine",
		]);
		expect(found.find((chest) => chest.capacity === 70)).toMatchObject({
			id: "chest:locations.0.buildings.0.indoors.objects.0",
			location: "Farm / Shed / Shed",
			capacity: 70,
		});
	});

	it.each([
		{ specialChestType: "JunimoChest" },
		{ globalInventoryId: { string: "shared" } },
		{ globalInventoryId: 123 },
		{ specialChestType: "mod.unknown" },
		{ items: { Item: "opaque" } },
		{ items: { Item: [{ "@_xsi:nil": "true", opaque: "keep" }] } },
	])("keeps unsupported storage visible and read-only: %j", (fields) => {
		const document = fixture({
			name: "Farm",
			objects: { item: placed(chest(fields)) },
		});
		const original = structuredClone(document);
		const found = required(discoverPlacedChests(document)[0]);
		expect(found.supported).toBe(false);
		expect(found.reason).toBeTruthy();
		expect(found.slots).toEqual([]);
		expect(() => writeChestSlots(found, [item()])).toThrow(
			"Unsupported chest inventory",
		);
		expect(document).toEqual(original);
	});

	it("preserves singleton item nodes and opaque container members for explicit replacement", () => {
		const originalItem = item();
		const document = fixture({
			name: "Farm",
			objects: {
				item: placed(
					chest({ items: { Item: originalItem, opaque: { flag: "007" } } }),
				),
			},
		});
		const found = required(discoverPlacedChests(document)[0]);
		expect(found.slots[0]).toBe(originalItem);
		const slots = [...found.slots];
		slots[0] = item("Potato");
		writeChestSlots(found, slots);
		expect(found.raw.items).toEqual({
			Item: item("Potato"),
			opaque: { flag: "007" },
		});
		slots[0] = { "@_xsi:nil": "true" };
		writeChestSlots(found, slots);
		expect(found.raw.items).toEqual({ opaque: { flag: "007" } });
	});

	it("compacts plain nils on structural writes, retaining every whole nonempty record", () => {
		const document = fixture({
			name: "Farm",
			objects: {
				item: placed(
					chest({
						items: { Item: [item(), { "@_xsi:nil": "true" }, item("Potato")] },
					}),
				),
			},
		});
		const found = required(discoverPlacedChests(document)[0]);
		const slots = [...found.slots];
		slots[0] = { "@_xsi:nil": "true" };
		slots[12] = { opaque: [false, "007"], name: "Modded" };
		writeChestSlots(found, slots);
		expect(found.raw.items).toEqual({
			Item: [item("Potato"), { opaque: [false, "007"], name: "Modded" }],
		});
	});

	it("retains imported overflow without reducing addressable slots", () => {
		const document = fixture({
			name: "Farm",
			objects: {
				item: placed(
					chest({
						items: {
							Item: Array.from({ length: 41 }, (_, index) =>
								item(String(index)),
							),
						},
					}),
				),
			},
		});
		const found = required(discoverPlacedChests(document)[0]);
		expect(found.capacity).toBe(41);
		expect(found.slots).toHaveLength(41);
	});
});
