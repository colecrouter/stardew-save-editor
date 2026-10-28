import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { get } from "svelte/store";
import type { Save } from "../../codegen/save";
import { openEditor } from "../../src/lib/editor/editor-model";
import {
	setFarmSettings,
	readFarmSettings,
} from "../../src/lib/editor/farm-operations";
import { setCalendarDate } from "../../src/lib/editor/calendar-operations";
import { fixtureXml, parser, exportDocument } from "./fixtures";

const bytes = (text: string) => new TextEncoder().encode(text);

// These integration scenarios repeatedly parse or export the 6.6 MB save fixture.
// Match the calendar suites’ CI budget: assertions verify preservation and workflow,
// while the default unit-test timeout remains unchanged.
describe("full-save farm operations", { timeout: 15_000 }, () => {
	it("farm settings update multiplayer copies atomically and preserve opaque records through undo/export", async () => {
		const document = parser.parse(fixtureXml);
		const game = document.SaveGame as unknown as Save;
		// Include an unclaimed cabin record: shared farm copies belong to serialized
		// farmers even when the legacy presentation does not list that farmer by name.
		const guest = {
			...structuredClone(game.player),
			name: "",
			UniqueMultiplayerID: 123456789,
		};
		Object.assign(game.player, { modData: { opaque: "007" } });
		Object.assign(guest, { modData: { opaque: ["guest", "0007"] } });
		game.farmhands = { Farmer: [guest] };
		const opened = await openEditor(bytes(exportDocument(document)));
		try {
			const before = await opened.model.snapshot();
			const result = await opened.model.commands.transact(
				setFarmSettings({
					name: "New Farm",
					profitPercent: 75,
					monsters: true,
					mineRewards: "Remixed",
				}),
			);
			expect(result && Result.isSuccess(result)).toBe(true);
			const after = await opened.model.snapshot();
			const edited = after.document.SaveGame as unknown as Save;
			expect(edited.player.farmName).toBe("New Farm");
			expect(edited.player.difficultyModifier).toBe(0.75);
			if (!edited.farmhands) throw Error("Expected the edited farmhand copy");
			expect(edited.farmhands.Farmer[0]?.farmName).toBe("New Farm");
			expect(edited.farmhands.Farmer[0]?.difficultyModifier).toBe(0.75);
			expect(edited.shouldSpawnMonsters).toBe(true);
			expect(edited.shuffleMineChests).toBe("Remixed");
			expect(after.domainState).toEqual(before.domainState);
			expect(after.entries).toHaveLength(1);
			expect(after.entries[0]?.annotations[0]?.tags).toContain("farm");
			const expected = structuredClone(before.document);
			const expectedGame = expected.SaveGame as unknown as Save;
			expectedGame.player.farmName = "New Farm";
			expectedGame.player.difficultyModifier = 0.75;
			if (expectedGame.farmhands === "")
				throw Error("Expected the fixture farmhand container");
			const expectedGuest = expectedGame.farmhands.Farmer[0];
			if (!expectedGuest) throw Error("Expected the fixture farmhand copy");
			expectedGuest.farmName = "New Farm";
			expectedGuest.difficultyModifier = 0.75;
			expectedGame.shouldSpawnMonsters = true;
			expectedGame.shuffleMineChests = "Remixed";
			expect(after.document).toEqual(expected);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await opened.model.commands.redo();
			expect((await opened.model.snapshot()).document).toEqual(expected);
			const output = await opened.model.commands.export();
			expect(output && Result.isSuccess(output)).toBe(true);
			if (!output || Result.isFailure(output))
				throw Error("Expected a valid exported farm save");
			const reloaded = await openEditor(output.success);
			try {
				expect(get(reloaded.model.view)?.farm).toMatchObject({
					name: "New Farm",
					profitPercent: 75,
					monsters: true,
					mineRewards: "Remixed",
				});
				expect(get(reloaded.model.view)?.net).toEqual([]);
			} finally {
				await reloaded.close();
			}
		} finally {
			await opened.close();
		}
	});

	it("a failed grouped farm edit leaves the document, calendar state and redo branch unchanged", async () => {
		const opened = await openEditor(bytes(fixtureXml));
		try {
			await opened.model.commands.transact(
				setFarmSettings({ name: "Redo Farm" }),
			);
			await opened.model.commands.undo();
			const before = await opened.model.snapshot();
			const result = await opened.model.commands.transact(
				Effect.gen(function* () {
					yield* setCalendarDate({ day: 9 });
					yield* setFarmSettings({
						name: "Must not publish",
						profitPercent: 0,
					});
				}),
			);
			expect(result && Result.isFailure(result) && result.failure._tag).toBe(
				"FarmSettingsInvalid",
			);
			expect(await opened.model.snapshot()).toEqual(before);
			await opened.model.commands.redo();
			expect(get(opened.model.view)?.farm.name).toBe("Redo Farm");
		} finally {
			await opened.close();
		}
	});

	it("display defaults and custom mine modes do not become writes when another farm field changes", async () => {
		const document = parser.parse(fixtureXml);
		const game = document.SaveGame as unknown as Record<string, unknown>;
		const player = game.player as Record<string, unknown>;
		delete player.difficultyModifier;
		delete game.shouldSpawnMonsters;
		game.shuffleMineChests = "ModdedRewardMode";
		game.whichFarm = "ModdedMap";
		const initial = readFarmSettings(document);
		expect(initial.profitPercent).toBe(100);
		expect(initial.monsters).toBe(false);
		expect(initial.mineRewards).toBe("ModdedRewardMode");
		const opened = await openEditor(bytes(exportDocument(document)));
		try {
			await opened.model.commands.transact(
				setFarmSettings({ name: "Only Name" }),
			);
			const after = (await opened.model.snapshot()).document;
			expect(Object.hasOwn(after.SaveGame.player, "difficultyModifier")).toBe(
				false,
			);
			expect(Object.hasOwn(after.SaveGame, "shouldSpawnMonsters")).toBe(false);
			expect(
				(after.SaveGame as unknown as Record<string, unknown>)
					.shuffleMineChests,
			).toBe("ModdedRewardMode");
			expect(readFarmSettings(after).creation).toEqual(initial.creation);
		} finally {
			await opened.close();
		}
	});

	it("an imported out-of-range multiplier survives edits to other fields", async () => {
		const document = parser.parse(fixtureXml);
		const game = document.SaveGame as unknown as Save;
		// Request validation governs deliberate edits, not normalization of an
		// imported modded baseline that the user has not chosen to replace.
		game.player.difficultyModifier = 12.345;
		const opened = await openEditor(bytes(exportDocument(document)));
		try {
			const before = await opened.model.snapshot();
			const result = await opened.model.commands.transact(
				setFarmSettings({
					monsters: !readFarmSettings(before.document).monsters,
				}),
			);
			expect(result && Result.isSuccess(result)).toBe(true);
			const after = await opened.model.snapshot();
			expect(
				(after.document.SaveGame as unknown as Save).player.difficultyModifier,
			).toBe(12.345);
			const expected = structuredClone(before.document);
			(expected.SaveGame as unknown as Save).shouldSpawnMonsters =
				!readFarmSettings(before.document).monsters;
			expect(after.document).toEqual(expected);
		} finally {
			await opened.close();
		}
	});

	it("farm no-ops retain no action and an explicit stale revision cannot overwrite newer calendar edits", async () => {
		const opened = await openEditor(bytes(fixtureXml));
		try {
			const initial = await opened.model.snapshot();
			await opened.model.commands.transact(setFarmSettings({}));
			const source = get(opened.model.view);
			if (!source) throw Error("Expected a committed farm projection");
			await opened.model.commands.transact(
				setFarmSettings({ name: source.farm.name }),
			);
			expect(await opened.model.snapshot()).toEqual(initial);
			await opened.model.commands.transact(setCalendarDate({ day: 8 }));
			const beforeStale = await opened.model.snapshot();
			const result = await opened.model.commands.transact(
				setFarmSettings({ name: "Stale Name" }),
				source.revision,
			);
			expect(
				result && Result.isFailure(result) && result.failure,
			).toMatchObject({
				_tag: "MutationError",
			});
			expect(await opened.model.snapshot()).toEqual(beforeStale);
		} finally {
			await opened.close();
		}
	});

	it("inherited monster settings do not become edits alongside an own farm name", async () => {
		const document = parser.parse(fixtureXml);
		// Force a baseline opposite the prototype value so a leaked inherited edit
		// cannot pass simply because the fixture already had monsters enabled.
		(document.SaveGame as unknown as Save).shouldSpawnMonsters = false;
		const opened = await openEditor(bytes(exportDocument(document)));
		try {
			const before = await opened.model.snapshot();
			const request = Object.assign(
				Object.create({ monsters: true, profitPercent: 0 }),
				{ name: "Own" },
			);
			const result = await opened.model.commands.transact(
				setFarmSettings(request),
			);
			expect(result && Result.isSuccess(result)).toBe(true);
			const after = await opened.model.snapshot();
			const expected = structuredClone(before.document);
			expected.SaveGame.player.farmName = "Own";
			expect(after.document).toEqual(expected);
			expect(
				(after.document.SaveGame as unknown as Save).shouldSpawnMonsters,
			).toBe(false);
			expect(after.entries).toHaveLength(1);
		} finally {
			await opened.close();
		}
	});

	it.each([
		{ name: "   " },
		{ profitPercent: 0 },
		{ profitPercent: 1001 },
		{ profitPercent: Number.NaN },
		{ mineRewards: "Unsupported" },
		{ monsters: "yes" as never },
		// Runtime callers may bypass TypeScript; validation must reject the entire
		// request before a valid sibling field can produce any staged writes.
		{ name: "Must not publish", profitPercent: undefined } as never,
		{ name: "Must not publish", unsupportedSetting: true } as never,
		Object.assign(Object.create({ profitPercent: 75 }), {
			name: "Must not publish",
			profitPercent: 0,
		}) as never,
	])(
		"invalid farm request %j preserves all committed state",
		async (change) => {
			const opened = await openEditor(bytes(fixtureXml));
			try {
				const before = await opened.model.snapshot();
				const result = await opened.model.commands.transact(
					setFarmSettings(change),
				);
				expect(result && Result.isFailure(result) && result.failure._tag).toBe(
					"FarmSettingsInvalid",
				);
				expect(await opened.model.snapshot()).toEqual(before);
			} finally {
				await opened.close();
			}
		},
	);
});
