import { describe, expect, it } from "vitest";
import type { Item, Save } from "../codegen/save";
import {
	type ChestKind,
	ChestProxy,
	discoverChests,
	type RawChest,
	SwappableChests,
} from "../src/lib/proxies/Chest.svelte";
import { XMLManager } from "../src/lib/workers/xml";

const item = (name: string, itemId: string): Item =>
	({
		"@_xsi:type": "Object",
		name,
		itemId,
		stack: 1,
		quality: 0,
		isRecipe: false,
		hasBeenInInventory: true,
	}) as Item;

// A placed chest, as the game saves one
const rawChest = (
	fields: Record<string, unknown> = {},
	items = [item("Wood", "388"), item("Stone", "390")],
): RawChest =>
	({
		"@_xsi:type": "Chest",
		name: "Chest",
		itemId: 130,
		parentSheetIndex: 130,
		currentLidFrame: 131,
		stack: 1,
		quality: 0,
		isRecipe: false,
		hasBeenInInventory: true,
		playerChest: true,
		fridge: false,
		specialChestType: "None",
		playerChoiceColor: { R: 0, G: 170, B: 0, A: 255 },
		separateWalletItems: { SerializableDictionaryOfInt64Inventory: "" },
		items: { Item: items },
		...fields,
	}) as unknown as RawChest;

const bigChest = (items: Item[]) =>
	rawChest(
		{
			name: "Big Chest",
			itemId: "BigChest",
			parentSheetIndex: 304,
			currentLidFrame: 305,
			specialChestType: "BigChest",
		},
		items,
	);

const miniShippingBin = (fields: Record<string, unknown> = {}) =>
	rawChest({
		name: "Mini-Shipping Bin",
		itemId: 248,
		parentSheetIndex: 248,
		currentLidFrame: 249,
		...fields,
	});

/** Discover the chests of a farm with `objects` placed at (3, 4), (4, 4)... */
const load = (...objects: RawChest[]) => {
	const save = {
		locations: {
			GameLocation: [
				{
					name: "Farm",
					objects: {
						item: objects.map((object, i) => ({
							key: { Vector2: { X: 3 + i, Y: 4 } },
							value: { Object: object },
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
	const [chest] = chests;
	if (!chest) throw new Error("Expected a chest");
	return { chest, chests, cleanup };
};

const type = (name: string) => {
	const found = SwappableChests.find((type) => type.name === name);
	if (!found) throw new Error(`No ${name}`);
	return found;
};

const savedItems = (raw: RawChest) =>
	raw.items ? raw.items.Item.map((item) => item as Item) : [];
const itemNames = (raw: RawChest) => savedItems(raw).map((item) => item.name);
const stacks = (raw: RawChest) => savedItems(raw).map((item) => item.stack);

describe("changing a chest's type", () => {
	it("swaps a Chest for a Stone Chest, keeping its items and colour", () => {
		const raw = rawChest();
		const { chest, cleanup } = load(raw);
		expect(chest.type?.name).toBe("Chest");

		chest.setType(type("Stone Chest"));
		expect(raw).toMatchObject({
			name: "Stone Chest",
			itemId: "232",
			parentSheetIndex: 232,
			currentLidFrame: 233,
			specialChestType: "None",
			playerChoiceColor: { R: 0, G: 170, B: 0 },
		});
		expect(chest.type?.name).toBe("Stone Chest");
		expect(chest.inventory.slotCount).toBe(36);
		expect(itemNames(raw)).toEqual(["Wood", "Stone"]);
		expect(chest.metadata.label).toBe("Farm - Stone Chest (3, 4)");
		cleanup();
	});

	it("expands a Chest to a 70-slot Big Chest, leaving items where they are", () => {
		const raw = rawChest();
		const { chest, cleanup } = load(raw);
		const stone = chest.inventory.take(1);
		if (stone) chest.inventory.place(20, stone);

		chest.setType(type("Big Chest"));
		expect(raw).toMatchObject({
			name: "Big Chest",
			itemId: "BigChest",
			parentSheetIndex: 304,
			currentLidFrame: 305,
			specialChestType: "BigChest",
		});
		expect(chest.inventory.slotCount).toBe(70);
		expect(chest.inventory.get(20)).toBe(stone);
		expect(chest.inventory.get(69)).toBeUndefined();

		// Big Chest and Big Stone Chest are the same size
		chest.setType(type("Big Stone Chest"));
		expect(raw).toMatchObject({
			itemId: "BigStoneChest",
			parentSheetIndex: 328,
			currentLidFrame: 329,
			specialChestType: "BigChest",
		});
		expect(chest.inventory.slotCount).toBe(70);
		expect(chest.metadata.label).toBe("Farm - Big Stone Chest (3, 4)");
		cleanup();
	});

	it("only shrinks a chest when every item fits, closing the gaps", () => {
		// 40 stacks of Wood, told apart by their size
		const many = Array.from({ length: 40 }, (_, i) => ({
			...item("Wood", "388"),
			stack: i + 1,
		}));
		const raw = bigChest(many);
		const { chest, cleanup } = load(raw);
		expect(chest.inventory.slotCount).toBe(70);

		// 40 items won't fit in 36 slots, so nothing changes
		expect(() => chest.setType(type("Chest"))).toThrow("won't fit");
		expect(raw).toMatchObject({ itemId: "BigChest", name: "Big Chest" });
		expect(chest.inventory.slotCount).toBe(70);
		expect(stacks(raw)).toHaveLength(40);

		// Once enough are gone, the rest move up into the 36 slots
		for (let i = 0; i < 4; i++) chest.inventory.delete(i);
		const last = chest.inventory.take(39);
		if (last) chest.inventory.place(69, last);
		chest.setType(type("Chest"));
		expect(chest.inventory.slotCount).toBe(36);
		expect(chest.inventory.usedSlots).toBe(36);
		expect(chest.inventory.get(35)).toBe(last);
		expect(stacks(raw)).toEqual(many.slice(4).map((item) => item.stack));
		cleanup();
	});

	it("expands a Mini-Shipping Bin to a 36-slot Chest", () => {
		const raw = miniShippingBin();
		const { chest, cleanup } = load(raw);
		expect(chest.type).toBeUndefined();
		expect(chest.isMiniShippingBin).toBe(true);
		expect(chest.inventory.slotCount).toBe(9);

		chest.expandMiniShippingBin();
		expect(raw).toMatchObject({
			name: "Chest",
			itemId: "130",
			parentSheetIndex: 130,
			currentLidFrame: 131,
			specialChestType: "None",
		});
		expect(chest.type?.name).toBe("Chest");
		expect(chest.isMiniShippingBin).toBe(false);
		expect(chest.inventory.slotCount).toBe(36);
		expect(itemNames(raw)).toEqual(["Wood", "Stone"]);
		expect(chest.metadata.label).toBe("Farm - Chest (3, 4)");
		cleanup();
	});

	it("won't expand a Mini-Shipping Bin holding items for separate wallets", () => {
		const raw = miniShippingBin({
			separateWalletItems: {
				SerializableDictionaryOfInt64Inventory: {
					item: {
						key: { long: 123 },
						value: { Inventory: { Item: [item("Parsnip", "24")] } },
					},
				},
			},
		});
		const { chest, cleanup } = load(raw);
		expect(chest.hasSeparateWalletItems).toBe(true);
		expect(() => chest.expandMiniShippingBin()).toThrow("separate wallets");
		expect(raw).toMatchObject({ itemId: 248, name: "Mini-Shipping Bin" });
		cleanup();
	});

	it("leaves fridges and machines' storage alone", () => {
		// The kitchen fridge is saved as a Chest (130), like the auto-grabber's storage
		const save = {
			locations: {
				GameLocation: [
					{
						name: "FarmHouse",
						fridge: rawChest(),
						objects: {
							item: [
								{
									key: { Vector2: { X: 2, Y: 1 } },
									value: {
										Object: {
											"@_xsi:type": "Object",
											name: "Auto-Grabber",
											heldObject: rawChest(),
										},
									},
								},
							],
						},
						buildings: "",
					},
				],
			},
		} as unknown as Save;
		let kinds: ChestKind[] = [];
		const cleanup = $effect.root(() => {
			const chests = discoverChests(save);
			kinds = chests.map((chest) => chest.metadata.kind);
			for (const chest of chests) {
				expect(chest.type).toBeUndefined();
				expect(chest.isMiniShippingBin).toBe(false);
				expect(() => chest.setType(type("Big Chest"))).toThrow();
			}
		});
		expect(kinds).toEqual(["fridge", "machine"]);
		cleanup();
	});

	it("gives a Junimo Chest no type to change", () => {
		const junimo = rawChest({
			name: "Junimo Chest",
			itemId: 256,
			specialChestType: "JunimoChest",
		});
		const cleanup = $effect.root(() => {
			const chest = new ChestProxy(junimo, {
				id: "junimo",
				label: "Farm - Junimo Chest (1, 1)",
				kind: "chest",
				location: "Farm",
			});
			expect(chest.type).toBeUndefined();
			expect(chest.isMiniShippingBin).toBe(false);
		});
		cleanup();
	});

	it("writes the new type to the save file", () => {
		const raw = rawChest();
		const { chest, cleanup } = load(raw);
		chest.setType(type("Big Stone Chest"));
		const xml = new TextDecoder().decode(
			new XMLManager().stringify({ SaveGame: { chest: raw } }),
		);
		expect(xml).toContain("<itemId>BigStoneChest</itemId>");
		expect(xml).toContain("<parentSheetIndex>328</parentSheetIndex>");
		expect(xml).toContain("<specialChestType>BigChest</specialChestType>");
		expect(xml).toContain("<currentLidFrame>329</currentLidFrame>");
		cleanup();
	});
});
