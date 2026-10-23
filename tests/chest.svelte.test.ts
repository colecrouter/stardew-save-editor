import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import type { Item, Save } from "../codegen/save";
import {
	discoverChests,
	type RawChest,
	searchChests,
} from "../src/lib/proxies/Chest.svelte";
import { Item as ItemFactory } from "../src/lib/proxies/Item.svelte";

const wood = (): Item =>
	({
		"@_xsi:type": "Object",
		name: "Wood",
		itemId: "388",
		stack: 10,
		quality: 0,
		isRecipe: false,
		hasBeenInInventory: true,
	}) as Item;

const chest = (name = "Chest"): RawChest =>
	({
		"@_xsi:type": "Chest",
		name,
		stack: 1,
		quality: 0,
		isRecipe: false,
		hasBeenInInventory: true,
		playerChest: true,
		fridge: false,
		specialChestType: name === "Big Chest" ? "BigChest" : "None",
		items: { Item: [wood()] },
	}) as RawChest;

describe("chest discovery and editing", () => {
	it("finds placed, machine, building, and fridge containers", () => {
		const placed = chest();
		const machine = chest();
		const buildingChest = chest();
		const fridge = { ...chest(), "@_xsi:type": undefined, fridge: true };
		const save = {
			locations: {
				GameLocation: [
					{
						name: "Farm",
						fridge,
						objects: {
							item: [
								{
									key: { Vector2: { X: 10, Y: 20 } },
									value: { Object: placed },
								},
								{
									key: { Vector2: { X: 4, Y: 8 } },
									value: {
										Object: {
											"@_xsi:type": "Object",
											name: "Auto-Grabber",
											heldObject: machine,
										},
									},
								},
							],
						},
						buildings: {
							Building: [
								{
									buildingType: "Mill",
									buildingChests: { Chest: [buildingChest] },
								},
							],
						},
					},
				],
			},
		} as unknown as Save;

		let discovered = [] as ReturnType<typeof discoverChests>;
		const cleanup = $effect.root(() => {
			discovered = discoverChests(save);
		});
		flushSync();

		expect(discovered).toHaveLength(4);
		expect(discovered.map(({ metadata }) => metadata.kind)).toEqual([
			"fridge",
			"chest",
			"machine",
			"building",
		]);
		expect(discovered[1]?.metadata.label).toContain("(10, 20)");
		cleanup();
	});

	it("adds, edits, and deletes only the chest item list", () => {
		const raw = chest("Big Chest");
		const save = {
			locations: {
				GameLocation: [
					{
						name: "Farm",
						objects: {
							item: [
								{
									key: { Vector2: { X: 1, Y: 2 } },
									value: { Object: raw },
								},
							],
						},
						buildings: "",
					},
				],
			},
		} as unknown as Save;

		let discovered = [] as ReturnType<typeof discoverChests>;
		const cleanup = $effect.root(() => {
			discovered = discoverChests(save);
		});
		const target = discovered[0];
		if (!target) throw new Error("Expected a chest");

		expect(target.inventory.slotCount).toBe(70);
		expect(target.inventory.usedSlots).toBe(1);
		target.inventory.set(1, ItemFactory.fromName("Stone"));
		flushSync();
		expect(target.inventory.usedSlots).toBe(2);
		const items = () => {
			const container = raw.items;
			if (!container || typeof container === "string") {
				throw new Error("Expected item list");
			}
			return container.Item;
		};
		expect(items()).toHaveLength(2);
		expect(items()[1]).toMatchObject({ name: "Stone" });

		target.inventory.delete(0);
		expect(target.inventory.usedSlots).toBe(1);
		expect(items()).toHaveLength(1);
		expect(items()[0]).toMatchObject({ name: "Stone" });
		cleanup();
	});

	it("searches item names across every chest", () => {
		const first = chest();
		const second = chest("Big Chest");
		const save = {
			locations: {
				GameLocation: [
					{
						name: "Farm",
						objects: {
							item: [
								{
									key: { Vector2: { X: 1, Y: 2 } },
									value: { Object: first },
								},
								{
									key: { Vector2: { X: 3, Y: 4 } },
									value: { Object: second },
								},
							],
						},
						buildings: "",
					},
				],
			},
		} as unknown as Save;

		let discovered = [] as ReturnType<typeof discoverChests>;
		const cleanup = $effect.root(() => {
			discovered = discoverChests(save);
		});
		discovered[1]?.inventory.set(1, ItemFactory.fromName("Stone"));
		flushSync();

		const wood = searchChests(discovered, "  wOo ");
		expect(wood.map((r) => [r.chestIndex, r.slotIndex])).toEqual([
			[0, 0],
			[1, 0],
		]);
		expect(wood[0]?.item.name).toBe("Wood");

		const stone = searchChests(discovered, "stone");
		expect(stone.map((r) => [r.chestIndex, r.slotIndex])).toEqual([[1, 1]]);

		expect(searchChests(discovered, "")).toEqual([]);
		expect(searchChests(discovered, "   ")).toEqual([]);
		expect(searchChests(discovered, "iridium")).toEqual([]);
		cleanup();
	});
});

describe("chests with a shared inventory", () => {
	it("leaves out Junimo Chests and other chests with a global inventory", () => {
		const nilString = { string: { "@_xsi:nil": "true" } };
		const placed = chest();
		const junimo = {
			...chest("Junimo Chest"),
			itemId: "256",
			specialChestType: "JunimoChest",
			globalInventoryId: nilString,
		} as unknown as RawChest;
		const shared = {
			...chest(),
			globalInventoryId: { string: "SomeModInventory" },
		} as RawChest;
		const ordinary = {
			...chest(),
			globalInventoryId: nilString,
		} as unknown as RawChest;
		const entry = (x: number, object: RawChest) => ({
			key: { Vector2: { X: x, Y: 0 } },
			value: { Object: object },
		});
		const save = {
			locations: {
				GameLocation: [
					{
						name: "Farm",
						objects: {
							item: [
								entry(1, placed),
								entry(2, junimo),
								entry(3, shared),
								entry(4, ordinary),
							],
						},
						buildings: "",
					},
				],
			},
		} as unknown as Save;

		let discovered = [] as ReturnType<typeof discoverChests>;
		const cleanup = $effect.root(() => {
			discovered = discoverChests(save);
		});
		// The game shows the shared inventory, so items moved into these would be lost
		expect(discovered.map(({ metadata }) => metadata.x)).toEqual([1, 4]);
		cleanup();
	});
});
