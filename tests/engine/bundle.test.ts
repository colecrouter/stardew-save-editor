import { vi } from "vitest";
import type { FixtureSave as Save } from "../helpers/editor-document.ts";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { expect, it } from "@effect/vitest";
import { readFile } from "node:fs/promises";
import { get } from "svelte/store";
import { openDocument } from "./editor-model.ts";
import { parser } from "./fixture.ts";

// Retain the engine suite's budget for full-save codecs and worker round trips.
vi.setConfig({ testTimeout: 15_000 });

type FullDocument = SaveDocument & { SaveGame: Save };

it("a late room-mail failure rolls back staged donations and rewards", async () => {
	const document = await fixture();
	for (const entry of center(document).bundles)
		if ([14, 15, 16, 17, 19].includes(entry.key)) entry.value.fill(true);
	Object.assign(document.SaveGame.player, {
		mailReceived: { unsupported: "modded mail container" },
	});
	const opened = await openDocument(document);
	try {
		const before = await opened.model.snapshot();
		await expect(
			opened.model.execute([{ type: "bundle-complete", bundleId: 13 }]),
		).rejects.toThrow("mail flags");
		expect(await opened.model.snapshot()).toEqual(before);
	} finally {
		await opened.close();
	}
}, 60_000);
const fixture = async () =>
	parser.parse(
		await readFile(new URL("../../tests/TestSave", import.meta.url), "utf8"),
	) as unknown as FullDocument;
function must<T>(value: T | undefined | null): NonNullable<T> {
	if (value == null) throw new Error("Required fixture field is absent");
	return value as NonNullable<T>;
}
function center(document: FullDocument) {
	const cc = must(
		document.SaveGame.locations.find(
			(location) => location?.name === "CommunityCenter",
		),
	);
	if (
		cc.$type !== "StardewValley.Locations.CommunityCenter" ||
		!cc.bundles ||
		!cc.areasComplete
	)
		throw new Error("Incomplete Community Center fixture");
	return cc as typeof cc &
		Required<Pick<typeof cc, "bundles" | "areasComplete">>;
}
const progress = (document: FullDocument) =>
	must(center(document).bundles.find((entry) => entry.key === 13)).value;

it("bundle completion is one compound history entry, preserves opaque fields and unused slots, and roundtrips", async () => {
	const document = await fixture();
	const cc = center(document);
	progress(document)[11] = true;
	Object.assign(cc, { opaqueModData: { value: "retain" } });
	const opened = await openDocument(document);
	try {
		await opened.model.execute([{ type: "bundle-complete", bundleId: 13 }]);
		const state = await opened.model.snapshot();
		expect(get(opened.model.view)?.bundle).toMatchObject({
			completed: true,
			rewardAvailable: true,
		});
		expect(state.entries).toHaveLength(1);
		const after = parser.parse(
			new TextDecoder().decode(await opened.model.export()),
		) as unknown as FullDocument;
		const flags = progress(after);
		expect(flags.slice(0, 4)).toEqual([true, true, true, true]);
		expect(flags[11]).toBe(true);
		expect(
			(center(after) as unknown as { opaqueModData: unknown }).opaqueModData,
		).toEqual({ value: "retain" });
		await opened.model.undo();
		expect((await opened.model.snapshot()).document).toEqual(document);
		await opened.model.redo();
		expect((await opened.model.snapshot()).document).toEqual(after);
	} finally {
		await opened.close();
	}
}, 60_000);

it("last Crafts Room bundle includes room and multiplayer completion mail in the same reversible action", async () => {
	const document = await fixture();
	const cc = center(document);
	for (const entry of cc.bundles)
		if ([14, 15, 16, 17, 19].includes(entry.key)) entry.value.fill(true);
	cc.areasComplete = [true, false, true, true, true, true];
	document.SaveGame.player.mailReceived?.push("mod.mail.keep", "mod.mail.keep");
	const opened = await openDocument(document);
	try {
		await opened.model.execute([{ type: "bundle-complete", bundleId: 13 }]);
		const after = parser.parse(
			new TextDecoder().decode(await opened.model.export()),
		) as unknown as FullDocument;
		expect(center(after).areasComplete).toEqual([
			true,
			true,
			true,
			true,
			true,
			true,
		]);
		const players = [
			after.SaveGame.player,
			...(!Array.isArray(after.SaveGame.farmhands)
				? []
				: after.SaveGame.farmhands),
		];
		for (const player of players) {
			expect(player.mailReceived).toContain("ccCraftsRoom");
			expect(player.mailReceived).toContain("ccIsComplete");
			expect(player.mailReceived).toContain("seenJunimoNote");
		}
		expect(after.SaveGame.player.mailReceived).toContain("mod.mail.keep");
		expect(
			after.SaveGame.player.mailReceived?.filter(
				(flag) => flag === "mod.mail.keep",
			),
		).toHaveLength(2);
		await opened.model.undo();
		expect((await opened.model.snapshot()).document).toEqual(document);
	} finally {
		await opened.close();
	}
}, 60_000);

it("claimed rewards remain claimed and unsupported definitions cannot partially commit another domain", async () => {
	const document = await fixture();
	progress(document).fill(true);
	const opened = await openDocument(document);
	try {
		await opened.model.execute([{ type: "bundle-complete", bundleId: 13 }]);
		expect(get(opened.model.view)?.entries).toEqual([]);
		expect(get(opened.model.view)?.bundle.rewardAvailable).toBe(false);
	} finally {
		await opened.close();
	}
	must(
		document.SaveGame.bundleData?.find(
			(entry: { key: string }) => entry.key === "Crafts Room/13",
		),
	).value = "modded";
	const unsupported = await openDocument(document);
	try {
		const before = await unsupported.model.snapshot();
		expect(get(unsupported.model.view)?.bundle.supported).toBe(false);
		await expect(
			unsupported.model.execute([
				{ type: "calendar-date", change: { day: 9 } },
				{ type: "bundle-complete", bundleId: 13 },
			]),
		).rejects.toThrow("vanilla");
		expect(await unsupported.model.snapshot()).toEqual(before);
	} finally {
		await unsupported.close();
	}
}, 60_000);
