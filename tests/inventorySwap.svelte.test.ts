import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Player } from "../codegen/save";
import { Inventory } from "../src/lib/proxies/Inventory.svelte";
import { Item } from "../src/lib/proxies/Item.svelte";
import { Raw } from "../src/lib/proxies/index";

const nil = { "@_xsi:nil": "true" };

describe("Inventory.swap", () => {
	let player: Player;
	let inventory!: Inventory;
	let cleanup: () => void;

	beforeEach(() => {
		player = { items: { Item: [nil, nil, nil] } } as unknown as Player;
		cleanup = $effect.root(() => {
			inventory = new Inventory(player);
		});
		flushSync();
	});
	afterEach(() => cleanup());

	it("swaps two slots, keeping both items' edits saved", () => {
		const parsnip = Item.fromName("Parsnip");
		const stone = Item.fromName("Stone");
		inventory.set(0, parsnip);
		inventory.set(1, stone);

		inventory.swap(0, 1);
		expect(inventory.get(0)).toBe(stone);
		expect(inventory.get(1)).toBe(parsnip);
		expect(player.items.Item[0]).toBe(stone[Raw]);
		expect(player.items.Item[1]).toBe(parsnip[Raw]);

		// Neither item was disposed, so edits still reach the save
		parsnip.quality = 2;
		stone.quality = 1;
		flushSync();
		expect(player.items.Item[1]?.quality).toBe(2);
		expect(player.items.Item[0]?.quality).toBe(1);
	});

	it("moves an item into an empty slot", () => {
		const parsnip = Item.fromName("Parsnip");
		inventory.set(0, parsnip);

		inventory.swap(0, 2);
		expect(inventory.get(0)).toBeUndefined();
		expect(player.items.Item[0]).toEqual(nil);
		expect(inventory.get(2)).toBe(parsnip);

		parsnip.quality = 4;
		flushSync();
		expect(player.items.Item[2]?.quality).toBe(4);
	});

	it("moves a Secret Note, which the inventory doesn't load", () => {
		const note = {
			"@_xsi:type": "Object",
			name: "Secret Note #7",
			itemId: "79",
			stack: 1,
		};
		// biome-ignore lint/suspicious/noExplicitAny: poking at raw parsed save data
		(player.items.Item as any[])[0] = note;
		const parsnip = Item.fromName("Parsnip");
		inventory.set(1, parsnip);

		inventory.swap(0, 1);
		expect(player.items.Item[1]).toBe(note);
		expect(player.items.Item[0]).toBe(parsnip[Raw]);
		expect(inventory.get(0)).toBe(parsnip);
		expect(inventory.get(1)).toBeUndefined();
	});
});
