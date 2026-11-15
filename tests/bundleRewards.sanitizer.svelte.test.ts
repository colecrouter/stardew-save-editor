import { flushSync, tick } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";

import { Raw } from "$lib/proxies";

import { SaveManager } from "../src/lib/SaveManager.svelte";
import publicSaveXml from "./TestSave?raw";

// Verifies sanitizer keeps bundleRewards[36] false after completing all bundles.

describe("CommunityBundles sanitizer", () => {
	let saveManager: SaveManager;

	// Setup uses the shared hook deadline independently of the test-body deadline.
	beforeEach(async () => {
		const file = publicSaveXml;
		let promise: Promise<void | boolean> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([file], "TestSave"));
		});
		await promise;
		flushSync();
		cleanup();
	});

	it("forces bundleRewards[36] to stay false after all bundles are completed", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		const cc = save.locations.find((l) => l[Raw].name === "CommunityCenter");
		expect(cc).toBeTruthy();
		if (!cc) return;

		// Snapshot initial bundleRewards state (key -> boolean)
		const initialRewardsArray = cc[Raw].bundleRewards?.item ?? [];
		const initialMap = new Map<number, boolean>(
			initialRewardsArray.map((kv) => [kv.key.int, kv.value.boolean]),
		);

		// Complete all bundle requirements
		for (const bundle of save.communityBundles?.values() ?? []) {
			for (const req of bundle.requiredItems) req.submitted = true;
		}
		flushSync();
		await tick();

		// All bundles should now report completed
		for (const bundle of save.communityBundles?.values() ?? []) {
			expect(bundle.completed).toBe(true);
		}

		// Sanitize runs via side-effects; capture post state
		const postRewards = cc[Raw].bundleRewards?.item ?? [];

		// Assert no new keys (other than possible removal of invalid) and all unchanged except 36
		const postKeys = new Set(postRewards.map((kv) => kv.key.int));
		for (const k of postKeys) {
			if (k === 36) continue;
			expect(initialMap.has(k)).toBe(true);
		}
		for (const k of initialMap.keys()) {
			if (k === 36) continue; // skip special case
			expect(postKeys.has(k)).toBe(true);
		}

		for (const kv of postRewards) {
			// Only the special reward changes; every other saved flag retains its prior value.
			expect(kv.value.boolean).toBe(
				kv.key.int === 36 ? false : initialMap.get(kv.key.int),
			);
		}
	});
});
