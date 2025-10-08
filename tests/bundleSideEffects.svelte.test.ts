import { readFile } from "node:fs/promises";
import { CCRoom } from "$lib/bundleSideEffects";
import { MailFlag } from "$lib/proxies/Mail.svelte";
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

	/**
	 * Base behavior: finishing ALL bundles (including Abandoned Joja Mart) should mark CC complete
	 * and give door access for non-Joja players.
	 */
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

	/**
	 * Base behavior Joja route: even if all bundles are force-completed in editor, access flag should
	 * not be set because vanilla Joja path never uses storm-door unlock. We still expect ccIsComplete
	 * because editor models overall completion, but access is cleared.
	 */
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

	/**
	 * Regression scenario (#80 / #75): Non-Joja + six original rooms complete, Abandoned Joja Mart
	 * room incomplete. We should STILL have ccIsComplete & abandonedJojaMartAccessible. Previously
	 * a bug required the Abandoned room and stripped the access flag on unrelated edits.
	 */
	it("retains access when six core rooms complete and Abandoned room incomplete (non-Joja)", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// Ensure non-Joja
		save.player.mailReceived.delete(MailFlag.JojaMember);

		// Complete original six rooms; leave Abandoned incomplete
		for (const bundle of save.communityBundles?.values() ?? []) {
			if (bundle.room === CCRoom.AbandonedJojaMart) {
				// Ensure at least one requirement not submitted
				let madeIncomplete = false;
				for (const req of bundle.requiredItems) {
					if (req.submitted) {
						req.submitted = false;
						madeIncomplete = true;
						break;
					}
				}
				if (!madeIncomplete) {
					// if already all false, fine
				}
			} else {
				for (const req of bundle.requiredItems) req.submitted = true;
			}
		}

		flushSync();
		await tick();

		expect(save.player.mailReceived.has(MailFlag.ccIsComplete)).toBe(true);
		expect(
			save.player.mailReceived.has(MailFlag.abandonedJojaMartAccessible),
		).toBe(true);

		const abandonedRoomCompleted = [...(save.communityBundles?.values() ?? [])]
			.filter((b) => b.room === CCRoom.AbandonedJojaMart)
			.every((b) => b.completed);
		expect(abandonedRoomCompleted).toBe(false);
	});

	/**
	 * Follow-up: If after completion we un-complete a requirement in a core room, both ccIsComplete
	 * and abandonedJojaMartAccessible should be revoked.
	 */
	it("revokes access if a core room becomes incomplete after completion", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// Non-Joja path
		save.player.mailReceived.delete(MailFlag.JojaMember);

		// Complete six core rooms, leave Abandoned incomplete
		for (const bundle of save.communityBundles?.values() ?? []) {
			if (bundle.room === CCRoom.AbandonedJojaMart) {
				for (const req of bundle.requiredItems) req.submitted = false;
			} else {
				for (const req of bundle.requiredItems) req.submitted = true;
			}
		}

		flushSync();
		await tick();

		// Sanity pre-condition
		expect(save.player.mailReceived.has(MailFlag.ccIsComplete)).toBe(true);
		expect(
			save.player.mailReceived.has(MailFlag.abandonedJojaMartAccessible),
		).toBe(true);

		// Un-complete Pantry first requirement
		const pantry = [...(save.communityBundles?.values() ?? [])].find(
			(b) => b.room === CCRoom.Pantry,
		);
		expect(pantry).toBeTruthy();
		if (pantry) {
			const items = pantry.requiredItems;
			if (Array.isArray(items) && items.length > 0) {
				const first = items[0];
				if (first) first.submitted = false;
			}
		}

		flushSync();
		await tick();

		expect(save.player.mailReceived.has(MailFlag.ccIsComplete)).toBe(false);
		expect(
			save.player.mailReceived.has(MailFlag.abandonedJojaMartAccessible),
		).toBe(false);
	});
});
