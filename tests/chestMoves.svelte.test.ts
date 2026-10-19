import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import type { Item, Player, Save } from "../codegen/save";
import {
	moveItem,
	moveItems,
	sortChest,
	sortSlots,
} from "../src/lib/chestMoves";
import { Raw } from "../src/lib/proxies";
import { discoverChests, type RawChest } from "../src/lib/proxies/Chest.svelte";
import { Inventory } from "../src/lib/proxies/Inventory.svelte";
import { Item as ItemFactory } from "../src/lib/proxies/Item.svelte";

const obj = (
	name: string,
	fields: Partial<Record<string, unknown>> = {},
): Item =>
	({
		"@_xsi:type": "Object",
		name,
		itemId: "1",
		parentSheetIndex: 1,
		category: -75,
		type: "Basic",
		stack: 1,
		quality: 0,
		...fields,
	}) as unknown as Item;

/** Clay as the game saves it (from tests/TestSave), parsed like a real save */
const savedClay = (stack: number): Item =>
	({
		"@_xsi:type": "Object",
		isLostItem: false,
		category: -16,
		hasBeenInInventory: true,
		name: "Clay",
		parentSheetIndex: 330,
		itemId: 330,
		specialItem: false,
		isRecipe: false,
		quality: 0,
		stack,
		SpecialVariable: 0,
		tileLocation: { X: 0, Y: 0 },
		owner: 0,
		type: "Basic",
		canBeSetDown: true,
		canBeGrabbed: true,
		isSpawnedObject: false,
		questItem: false,
		isOn: true,
		fragility: 0,
		price: 20,
		edibility: -300,
		bigCraftable: false,
		flipped: true,
		minutesUntilReady: 0,
		boundingBox: {
			X: 0,
			Y: 0,
			Width: 0,
			Height: 0,
			Location: { X: 0, Y: 0 },
			Size: { X: 0, Y: 0 },
		},
		uses: 0,
	}) as unknown as Item;

const rawChest = (items: Item[]): RawChest =>
	({
		"@_xsi:type": "Chest",
		name: "Chest",
		itemId: 130,
		playerChest: true,
		specialChestType: "None",
		items: items.length ? { Item: items } : "",
	}) as unknown as RawChest;

/** Two chests on the farm */
const twoChests = (a: Item[], b: Item[]) => {
	const save = {
		locations: {
			GameLocation: [
				{
					name: "Farm",
					objects: {
						item: [a, b].map((items, x) => ({
							key: { Vector2: { X: x, Y: 0 } },
							value: { Object: rawChest(items) },
						})),
					},
					buildings: "",
				},
			],
		},
	} as unknown as Save;
	let chests = [] as ReturnType<typeof discoverChests>;
	const cleanup = $effect.root(() => {
		chests = discoverChests(save);
	});
	const [first, second] = chests;
	if (!first || !second) throw new Error("Expected two chests");
	return { first, second, cleanup };
};

const names = (chest: ReturnType<typeof twoChests>["first"]) =>
	Array.from({ length: chest.inventory.slotCount }, (_, i) =>
		chest.inventory.get(i),
	)
		.filter((item) => item !== undefined)
		.map((item) => item.name);

describe("moving chest items", () => {
	it("moves an item onto an empty slot in another chest", () => {
		const { first, second, cleanup } = twoChests([obj("Parsnip")], []);
		moveItem({ chest: first, index: 0 }, { chest: second, index: 5 });
		expect(first.inventory.get(0)).toBeUndefined();
		expect(second.inventory.get(5)?.name).toBe("Parsnip");
		// The item keeps working after the move (it isn't disposed)
		const moved = second.inventory.get(5);
		if (!moved) throw new Error("moved");
		moved.amount = 7;
		flushSync();
		expect(moved[Raw].stack).toBe(7);
		cleanup();
	});

	it("swaps with an item already in the target slot", () => {
		const { first, second, cleanup } = twoChests(
			[obj("Parsnip")],
			[obj("Kale")],
		);
		moveItem({ chest: first, index: 0 }, { chest: second, index: 0 });
		expect(first.inventory.get(0)?.name).toBe("Kale");
		expect(second.inventory.get(0)?.name).toBe("Parsnip");
		cleanup();
	});

	it("moves several items into another chest's free slots", () => {
		const { first, second, cleanup } = twoChests(
			[obj("Parsnip"), obj("Kale"), obj("Potato")],
			[obj("Leek")],
		);
		const result = moveItems(
			[
				{ chest: first, index: 0 },
				{ chest: first, index: 2 },
			],
			second,
		);
		expect(result).toMatchObject({ ok: true });
		expect(names(first)).toEqual(["Kale"]);
		expect(names(second)).toEqual(["Leek", "Parsnip", "Potato"]);
		cleanup();
	});

	it("moves nothing when the items won't all fit", () => {
		const full = Array.from({ length: 35 }, (_, i) => obj(`Thing ${i}`));
		const { first, second, cleanup } = twoChests(
			[obj("Parsnip"), obj("Kale")],
			full,
		);
		const result = moveItems(
			[
				{ chest: first, index: 0 },
				{ chest: first, index: 1 },
			],
			second,
		);
		expect(result).toEqual({ ok: false, needed: 2, free: 1 });
		expect(names(first)).toEqual(["Parsnip", "Kale"]);
		expect(second.inventory.usedSlots).toBe(35);
		cleanup();
	});
});

describe("sorting a chest like the game's Organize button", () => {
	it("puts tools first, then sorts by category, name and quality", () => {
		const { first, cleanup } = twoChests(
			[
				obj("Parsnip", { category: -75, type: "Basic" }),
				obj("Amethyst", { category: -2, type: "Minerals" }),
				{ "@_xsi:type": "Pickaxe", name: "Pickaxe", itemId: "Pickaxe" } as Item,
				obj("Kale", { category: -75, type: "Basic", quality: 1 }),
				obj("Kale", { category: -75, type: "Basic", quality: 4 }),
				obj("Wood", { category: -16, type: "Basic" }),
			],
			[],
		);
		sortChest(first);
		const sorted = Array.from({ length: 6 }, (_, i) => first.inventory.get(i));
		expect(sorted.map((item) => [item?.name, item?.[Raw].quality])).toEqual([
			["Pickaxe", undefined],
			["Amethyst", 0],
			["Wood", 0],
			["Kale", 4],
			["Kale", 1],
			["Parsnip", 0],
		]);
		cleanup();
	});

	it("combines identical stacks, up to 999", () => {
		const { first, cleanup } = twoChests(
			[
				obj("Wood", { stack: 600 }),
				obj("Wood", { stack: 300 }),
				obj("Wood", { stack: 200 }),
				obj("Wood", { stack: 5, quality: 2 }),
			],
			[],
		);
		sortChest(first);
		flushSync();
		const stacks = Array.from({ length: 36 }, (_, i) => first.inventory.get(i))
			.filter((item) => item !== undefined)
			// The saved stack sizes, not just the proxies'
			.map((item) => [item[Raw].quality, item[Raw].stack]);
		// 1100 normal Wood becomes 999 + 101; the gold Wood stays separate
		expect(stacks).toEqual([
			[2, 5],
			[0, 101],
			[0, 999],
		]);
		cleanup();
	});

	const stacks = (chest: ReturnType<typeof twoChests>["first"]) =>
		Array.from({ length: chest.inventory.slotCount }, (_, i) =>
			chest.inventory.get(i),
		)
			.filter((item) => item !== undefined)
			.map((item) => [item.name, item[Raw].stack]);

	it("stacks an item made in the editor with the same item from a save", () => {
		const { first, cleanup } = twoChests([savedClay(2)], []);
		const made = ItemFactory.fromName("Clay");
		made.amount = 3;
		first.inventory.place(1, made);
		flushSync();
		// Their other fields differ, down to the type of the id
		expect(first.inventory.get(0)?.[Raw].itemId).toBe(330);
		expect(made[Raw].itemId).toBe("330");

		sortChest(first);
		flushSync();
		expect(stacks(first)).toEqual([["Clay", 5]]);
		cleanup();
	});

	it("matches item ids with or without the (O) prefix", () => {
		const { first, cleanup } = twoChests(
			[savedClay(2), { ...savedClay(4), itemId: "(O)330" } as Item],
			[],
		);
		sortChest(first);
		flushSync();
		expect(stacks(first)).toEqual([["Clay", 6]]);
		cleanup();
	});

	it("keeps items of a different quality apart", () => {
		const { first, cleanup } = twoChests(
			[obj("Parsnip", { itemId: 24, parentSheetIndex: 24, quality: 1 })],
			[],
		);
		first.inventory.place(1, ItemFactory.fromName("Parsnip"));
		first.inventory.place(2, ItemFactory.fromName("Parsnip"));
		flushSync();

		sortChest(first);
		flushSync();
		const parsnips = Array.from({ length: 3 }, (_, i) => first.inventory.get(i))
			.filter((item) => item !== undefined)
			.map((item) => [item[Raw].quality, item[Raw].stack]);
		// Silver first, then the two normal ones stacked together
		expect(parsnips).toEqual([
			[1, 1],
			[0, 2],
		]);
		cleanup();
	});

	it("keeps coloured objects of a different colour apart", () => {
		const tulip = (R: number, G: number, B: number) =>
			obj("Tulip", {
				"@_xsi:type": "ColoredObject",
				itemId: 591,
				parentSheetIndex: 591,
				category: -80,
				color: { B, G, R, A: 255 },
			});
		const { first, cleanup } = twoChests(
			[tulip(255, 0, 0), tulip(255, 255, 0), tulip(255, 0, 0)],
			[],
		);
		sortChest(first);
		flushSync();
		const tulips = Array.from({ length: 3 }, (_, i) => first.inventory.get(i))
			.filter((item) => item !== undefined)
			.map((item) => [item[Raw].color?.G, item[Raw].stack]);
		// One yellow, then the two red ones stacked together
		expect(tulips).toEqual([
			[255, 1],
			[0, 2],
		]);
		cleanup();
	});

	it("keeps different flavours apart, as they have different names", () => {
		const made = ItemFactory.fromName("Blueberry Wine");
		const { R = 0, G = 0, B = 0 } = made[Raw].color ?? {};
		// The same colour, so only the name tells them apart
		const wine = (name: string, fruit: string) =>
			obj(name, {
				"@_xsi:type": "ColoredObject",
				itemId: 348,
				parentSheetIndex: 123,
				category: -26,
				preserve: "Wine",
				preservedParentSheetIndex: fruit,
				color: { B, G, R, A: 255 },
			});
		const { first, cleanup } = twoChests(
			[wine("Blueberry Wine", "258"), wine("Apple Wine", "613")],
			[],
		);
		first.inventory.place(2, made);
		flushSync();

		sortChest(first);
		flushSync();
		expect(stacks(first)).toEqual([
			["Apple Wine", 1],
			["Blueberry Wine", 2],
		]);
		cleanup();
	});

	it("never stacks objects the game keeps one to a slot", () => {
		const spinner = () =>
			obj("Spinner", { itemId: "686", parentSheetIndex: 686, category: -22 });
		const { first, cleanup } = twoChests([spinner(), spinner()], []);
		sortChest(first);
		flushSync();
		expect(stacks(first)).toEqual([
			["Spinner", 1],
			["Spinner", 1],
		]);
		cleanup();
	});
});

describe("sorting the backpack", () => {
	it("leaves Secret Notes, which the editor hides, where they are", () => {
		const nil = () => ({ "@_xsi:nil": "true" });
		const note = obj("Secret Note #12", {
			itemId: "79",
			parentSheetIndex: 79,
			category: 0,
			type: "asdf",
		});
		const player = {
			items: {
				Item: [
					nil(),
					obj("Parsnip", { itemId: "24", parentSheetIndex: 24 }),
					nil(),
					note,
					nil(),
					obj("Amethyst", {
						itemId: "66",
						parentSheetIndex: 66,
						category: -2,
						type: "Minerals",
					}),
					...Array.from({ length: 6 }, nil),
				],
			},
		} as unknown as Player;

		let inventory!: Inventory;
		const cleanup = $effect.root(() => {
			inventory = new Inventory(player);
		});
		expect(inventory.get(3)).toBeUndefined();

		sortSlots(inventory);
		flushSync();
		const saved = player.items.Item as unknown as { name?: string }[];
		expect(saved[3]).toBe(note);
		expect(saved.map((entry) => entry.name ?? null)).toEqual([
			"Amethyst",
			"Parsnip",
			null,
			"Secret Note #12",
			...Array.from({ length: 8 }, () => null),
		]);
		expect(inventory.get(0)?.name).toBe("Amethyst");
		expect(inventory.get(1)?.name).toBe("Parsnip");
		cleanup();
	});
});
