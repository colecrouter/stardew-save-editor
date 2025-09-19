import { MailFlag } from "$lib/proxies/Mail.svelte";
import { readFile } from "node:fs/promises";
import { flushSync, tick } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { SaveManager } from "../src/lib/SaveManager.svelte";

describe("bundle side effects - Abandoned JojaMart access", () => {
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

	it("sets abandonedJojaMartAccessible for non-Joja on CC completion", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;
		// Ensure player is NOT a Joja member
		save.player.mailReceived.delete(MailFlag.JojaMember);

		// Complete all bundle requirements
		for (const bundle of save.communityBundles?.values() ?? []) {
			for (const req of bundle.requiredItems) req.submitted = true;
		}

		flushSync();
		await tick();

		// Expect flags: ccIsComplete present, and Abandoned JojaMart accessible
		expect(save.player.mailReceived.has(MailFlag.ccIsComplete)).toBe(true);
		expect(
			save.player.mailReceived.has(MailFlag.abandonedJojaMartAccessible),
		).toBe(true);
	});

	it("does NOT set abandonedJojaMartAccessible when Joja member", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;
		// Mark player as Joja member
		save.player.mailReceived.add(MailFlag.JojaMember);

		// Complete all bundle requirements
		for (const bundle of save.communityBundles?.values() ?? []) {
			for (const req of bundle.requiredItems) req.submitted = true;
		}

		flushSync();
		await tick();

		// Expect ccIsComplete present, but Abandoned JojaMart access cleared
		expect(save.player.mailReceived.has(MailFlag.ccIsComplete)).toBe(true);
		expect(
			save.player.mailReceived.has(MailFlag.abandonedJojaMartAccessible),
		).toBe(false);
	});
});
