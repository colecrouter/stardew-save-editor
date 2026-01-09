import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import type { Bundle } from "../src/lib/proxies/CommunityBundles.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";

// Verify River Fish bundle reward is Deluxe Bait x30 (not gold)

describe("River Fish bundle reward", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		const file = await readFile("tests/TestSave");
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([file], "TestSave"));
		});
		await promise;
		flushSync();
		cleanup();
	});

	it("parses reward as DeluxeBait x30", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// Find Fish Tank room bundles and locate River Fish by its internal name
		const riverFish = [...(save.communityBundles?.values() ?? [])].find(
			(b: Bundle) =>
				b.name.toLowerCase().includes("river") &&
				b.name.toLowerCase().includes("fish"),
		);
		expect(riverFish).toBeTruthy();
		if (!riverFish) return;

		// Ensure reward parsed
		expect(riverFish.reward?.item).toBeTruthy();
		const r = riverFish.reward?.item;
		if (!r) return;
		// Should be type O (Object) with id "DeluxeBait" and quantity 30
		expect(r.type).toBe("O");
		expect(r.id).toBeTypeOf("string");
		expect(r.id).toBe("DeluxeBait");
		expect(r.quantity).toBe(30);
	});
});
