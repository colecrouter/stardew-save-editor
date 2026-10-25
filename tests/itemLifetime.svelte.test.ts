import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import { Item } from "$lib/proxies/Item.svelte";
import { SaveManager } from "$lib/SaveManager.svelte";

mockIDB();
it("reset releases factory-created backpack and chest item roots", async () => {
	let manager!: SaveManager;
	const stop = $effect.root(() => {
		manager = new SaveManager();
	});
	try {
		await manager.import(
			new File([await readFile("tests/TestSave", "utf8")], "TestSave"),
		);
		const save = manager.save;
		if (!save || !save.chests[0])
			throw new Error("Fixture needs a save and chest");
		const backpack = Item.fromName("Parsnip");
		const chest = Item.fromName("Parsnip");
		save.player.inventory.set(0, backpack);
		save.chests[0].inventory.set(0, chest);
		flushSync();
		backpack.stack = 12;
		chest.stack = 13;
		flushSync();
		expect(backpack[Raw].stack).toBe(12);
		expect(chest[Raw].stack).toBe(13);
		manager.reset();
		backpack.stack = 20;
		chest.stack = 21;
		flushSync();
		// Retained references can change their view state, but disposed effects
		// must no longer write through to the abandoned save document.
		expect(backpack[Raw].stack).toBe(12);
		expect(chest[Raw].stack).toBe(13);
	} finally {
		manager.reset();
		stop();
	}
}, 30_000);
