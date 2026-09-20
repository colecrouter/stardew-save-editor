import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import type { Item, Save } from "../codegen/save";
import { discoverChests, type RawChest } from "../src/lib/proxies/Chest.svelte";
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
});
