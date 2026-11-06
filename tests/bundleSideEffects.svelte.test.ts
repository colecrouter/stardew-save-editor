import { readFile } from "node:fs/promises";
import { flushSync, tick } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { CCRoom } from "$lib/bundleSideEffects";
import { Raw } from "$lib/proxies";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";

describe("bundle side effects - Abandoned JojaMart access", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		const file = await readFile("tests/TestSave");
		let promise: Promise<void | boolean> = Promise.resolve();
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
		save.player.mailReceived.delete(MailFlag.seenJunimoNote);
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
		expect(save.player.mailReceived.has(MailFlag.seenJunimoNote)).toBe(true);
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
		expect(save.player.mailReceived.has(MailFlag.seenJunimoNote)).toBe(true);
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
		expect(save.player.mailReceived.has(MailFlag.seenJunimoNote)).toBe(true);

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
		expect(save.player.mailReceived.has(MailFlag.seenJunimoNote)).toBe(true);

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
		expect(save.player.mailReceived.has(MailFlag.seenJunimoNote)).toBe(true);
	});

	/**
	 * Observed engine behavior (1.5/1.6):
	 * - CommunityCenter.getNotePosition() is hardcoded by area index (0..5). Any other index returns Point.Zero (0,0).
	 * - If areasComplete has a 7th entry (index 6) and it is FALSE, the game will still consider area 6 and the note renders at 0,0.
	 * - If the 7th entry exists and is TRUE (Abandoned Joja Mart complete), the stray note does not show.
	 *
	 * To avoid causing the 0,0 bug, the editor omits the 7th slot entirely when it's false, keeping a canonical 6-length array.
	 */
	it("omits the 7th areasComplete slot when Abandoned Joja Mart is incomplete (prevents 0,0 note)", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// Make sure original six rooms are complete; keep Abandoned incomplete
		for (const bundle of save.communityBundles?.values() ?? []) {
			if (bundle.room === CCRoom.AbandonedJojaMart) {
				for (const req of bundle.requiredItems) req.submitted = false;
			} else {
				for (const req of bundle.requiredItems) req.submitted = true;
			}
		}

		flushSync();
		await tick();

		const cc = save.locations.find((l) => l[Raw].name === "CommunityCenter");
		expect(cc).toBeTruthy();
		const arr = cc?.[Raw].areasComplete?.boolean;
		expect(Array.isArray(arr)).toBe(true);
		// Editor should omit index 6 entirely when it's logically false
		expect(arr?.length).toBe(6);
	});

	it("keeps the 7th areasComplete slot when Abandoned Joja Mart is complete (no stray 0,0 note)", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// Complete all rooms including Abandoned Joja Mart
		for (const bundle of save.communityBundles?.values() ?? []) {
			for (const req of bundle.requiredItems) req.submitted = true;
		}

		flushSync();
		await tick();

		const cc = save.locations.find((l) => l[Raw].name === "CommunityCenter");
		expect(cc).toBeTruthy();
		const arr = cc?.[Raw].areasComplete?.boolean ?? [];
		expect(arr.length).toBeGreaterThanOrEqual(7);
		expect(arr[6]).toBe(true);
	});
});

/**
 * The test save plus a farmhand, "Hand". `hostMail` and `handMail` are added
 * to each farmer's mailReceived.
 */
const loadCoop = async (hostMail: MailFlag[], handMail: MailFlag[]) => {
	const mail = (flags: MailFlag[]) =>
		flags.map((flag) => `<string>${flag}</string>`).join("");
	const xml = (await readFile("tests/TestSave")).toString("utf-8");
	const start = xml.indexOf("<player>") + "<player>".length;
	const farmhand = xml
		.slice(start, xml.indexOf("</player>"))
		.replace("<name>Test</name>", "<name>Hand</name>")
		.replace(
			/<UniqueMultiplayerID>-?\d+<\/UniqueMultiplayerID>/,
			"<UniqueMultiplayerID>123456789</UniqueMultiplayerID>",
		)
		.replace("<mailReceived>", `<mailReceived>${mail(handMail)}`);
	const coop = xml
		.replace("<mailReceived>", `<mailReceived>${mail(hostMail)}`)
		.replace(
			"<farmhands />",
			`<farmhands><Farmer>${farmhand}</Farmer></farmhands>`,
		);

	let saveManager!: SaveManager;
	let promise: Promise<void | boolean> = Promise.resolve();
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
		promise = saveManager.import(new File([coop], "TestSave"));
	});
	await promise;
	flushSync();
	const save = saveManager.save;
	if (!save?.communityBundles) throw new Error("Save not loaded");
	expect(save.players.map((p) => p.name)).toEqual(["Test", "Hand"]);
	return { save, bundles: save.communityBundles, cleanup };
};

const bundleNamed = (
	bundles: NonNullable<SaveProxy["communityBundles"]>,
	name: string,
) => {
	const bundle = [...bundles.values()].find((b) => b.name === name);
	if (!bundle) throw new Error(`No ${name} bundle`);
	return bundle;
};

describe("bundle side effects - flags the game set without bundles", () => {
	mockIDB();

	// Buying the bus from Joja sends these, without ticking any Vault bundle
	const boughtBus = [MailFlag.JojaMember, MailFlag.ccVault, MailFlag.jojaVault];

	it("keeps a bought Joja project when a bundle in another room is edited", async () => {
		const { save, bundles, cleanup } = await loadCoop(boughtBus, boughtBus);
		const bought = () =>
			save.players.map(
				(p) =>
					p.mailReceived.has(MailFlag.ccVault) &&
					p.mailReceived.has(MailFlag.jojaVault),
			);
		expect(bought()).toEqual([true, true]);

		// Finishing a Pantry bundle doesn't finish the Pantry, and the Vault didn't change
		const spring = bundleNamed(bundles, "Spring Crops");
		for (const item of spring.requiredItems) item.submitted = true;
		flushSync();
		await tick();
		expect(spring.completed).toBe(true);
		expect(bought()).toEqual([true, true]);

		for (const item of spring.requiredItems) item.submitted = false;
		flushSync();
		await tick();
		expect(bought()).toEqual([true, true]);
		cleanup();
	});

	it("keeps ccIsComplete when the game finished the Community Center without bundles", async () => {
		const jojaComplete = [...boughtBus, MailFlag.ccIsComplete];
		const { save, bundles, cleanup } = await loadCoop(
			jojaComplete,
			jojaComplete,
		);

		const spring = bundleNamed(bundles, "Spring Crops");
		for (const item of spring.requiredItems) item.submitted = true;
		flushSync();
		await tick();

		for (const player of save.players)
			expect(player.mailReceived.has(MailFlag.ccIsComplete)).toBe(true);
		cleanup();
	});

	it("reads Joja membership from the host, so switching farmer changes nothing", async () => {
		// The host joined Joja; the farmhand doesn't have the membership letter
		const { save, bundles, cleanup } = await loadCoop(
			[MailFlag.JojaMember],
			[],
		);

		// Finish the five rooms the Joja route needs (not the Bulletin Board)
		const jojaRooms = [
			CCRoom.Pantry,
			CCRoom.CraftsRoom,
			CCRoom.FishTank,
			CCRoom.BoilerRoom,
			CCRoom.Vault,
		];
		for (const bundle of bundles.values()) {
			if (!jojaRooms.includes(bundle.room)) continue;
			for (const item of bundle.requiredItems) item.submitted = true;
		}
		flushSync();
		await tick();
		const flags = () =>
			save.players.map((p) => [...p.mailReceived].toSorted().join());
		const before = flags();
		expect(save.players[0]?.mailReceived.has(MailFlag.ccIsComplete)).toBe(true);

		save.nextFarmer();
		flushSync();
		await tick();
		expect(save.player.name).toBe("Hand");
		expect(flags()).toEqual(before);

		save.prevFarmer();
		flushSync();
		await tick();
		expect(flags()).toEqual(before);
		cleanup();
	});

	it("still updates the joja room flags when the host's membership changes", async () => {
		const { save, bundles, cleanup } = await loadCoop([], []);
		for (const bundle of bundles.values()) {
			if (bundle.room !== CCRoom.Vault) continue;
			for (const item of bundle.requiredItems) item.submitted = true;
		}
		flushSync();
		await tick();
		const host = save.players[0];
		if (!host) throw new Error("No host");
		expect(host.mailReceived.has(MailFlag.ccVault)).toBe(true);
		expect(host.mailReceived.has(MailFlag.jojaVault)).toBe(false);

		for (const player of save.players)
			player.mailReceived.add(MailFlag.JojaMember);
		flushSync();
		await tick();
		for (const player of save.players)
			expect(player.mailReceived.has(MailFlag.jojaVault)).toBe(true);

		for (const player of save.players)
			player.mailReceived.delete(MailFlag.JojaMember);
		flushSync();
		await tick();
		for (const player of save.players)
			expect(player.mailReceived.has(MailFlag.jojaVault)).toBe(false);
		cleanup();
	});
});
