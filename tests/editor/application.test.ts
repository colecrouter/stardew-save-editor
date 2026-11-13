import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { get } from "svelte/store";
import { editorResources } from "../../src/lib/editor/editor-model";
import { openEditor } from "../helpers/open-editor.ts";
import {
	setCalendarDate,
	setCalendarWeather,
} from "../../src/lib/editor/calendar-operations";
import { fixtureXml, parser, exportDocument } from "./fixtures";
import type { Value as GeneratedSave } from "../../generated/save-format/save.ts";
type Save = GeneratedSave & { player: NonNullable<GeneratedSave["player"]> };

const bytes = (xml: string) => new TextEncoder().encode(xml);

// TestSave is a 6.6 MB preservation fixture. Encoding/reparsing it several times
// verifies data integrity, not latency; retain the experiment's integration budget
// on shared CI runners without changing the default timeout for unit tests.
describe("full-save application calendar", { timeout: 45_000 }, () => {
	it("the application calendar preserves unsupported inventory and bundle data without constructing those features", async () => {
		const document = parser.parse(fixtureXml);
		const raw = document.SaveGame as unknown as Record<string, unknown>;
		delete raw.bundleData;
		raw.player = {
			...(raw.player as object),
			items: [
				{
					$type: "StardewValley.Object",
					name: "Stone",
					itemId: "390",
					stack: 1,
					customField: "007",
					modData: [],
				},
			],
		};
		raw.customModData = { untouched: ["0007", { nested: "opaque" }] };
		const opened = await openEditor(bytes(exportDocument(document)));
		try {
			// Compare edits with the decoded baseline, including codec defaults for
			// the deliberately partial item constructed above.
			const before = (await opened.model.snapshot()).document;
			expect(get(opened.model.view)?.net).toEqual([]);
			expect(get(opened.model.view)?.bundle.supported).toBe(false);
			const result = await opened.model.commands.transact(
				setCalendarDate({ year: 3 }),
			);
			expect(result && Result.isSuccess(result)).toBe(true);
			const after = await opened.model.snapshot();
			expect(
				(after.document.SaveGame as unknown as Record<string, unknown>)
					.customModData,
			).toEqual(raw.customModData);
			expect(after.document.SaveGame.player.items).toEqual(
				before.SaveGame.player.items,
			);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			await opened.close();
		}
		expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });
	});

	it("the application validates exact exported bytes and blocks existing definite errors without mutating the baseline", async () => {
		const document = parser.parse(fixtureXml);
		// Structurally valid XML can still contain gameplay-invalid state.
		const locations = document.SaveGame.locations ?? [];
		document.SaveGame.locations = locations.filter(
			(location) => location?.name !== "Farm",
		);
		const opened = await openEditor(bytes(exportDocument(document)));
		try {
			expect(opened.model.loadValidation.valid).toBe(false);
			const before = await opened.model.snapshot();
			const result = await opened.model.commands.export();
			expect(result && Result.isFailure(result) && result.failure._tag).toBe(
				"SaveExportRejected",
			);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			expect(get(opened.model.view)?.net).toEqual([]);
		} finally {
			await opened.close();
		}
	});

	it("application date/weather export reimports with unknown fields and coordinated multiplayer dates intact", async () => {
		const document = parser.parse(fixtureXml);
		const game = document.SaveGame as unknown as Save;
		document.SaveGame.farmhands = [
			{
				...structuredClone(document.SaveGame.player),
				UniqueMultiplayerID: 123456789n,
				name: "Guest",
			},
		];
		Object.assign(game, { customModData: { untouched: "007" } });
		const opened = await openEditor(bytes(exportDocument(document)));
		try {
			const result = await opened.model.commands.transact(
				Effect.gen(function* () {
					yield* setCalendarDate({ year: 3, day: 8 });
					yield* setCalendarWeather("tomorrow", "Rain");
				}),
			);
			expect(result && Result.isSuccess(result)).toBe(true);
			const exported = await opened.model.commands.export();
			expect(exported && Result.isSuccess(exported)).toBe(true);
			if (!exported || Result.isFailure(exported))
				throw Error("Expected valid exported save");
			const reloaded = await openEditor(exported.success);
			try {
				expect(get(reloaded.model.view)?.calendar.date).toMatchObject({
					year: 3,
					day: 8,
				});
				expect(get(reloaded.model.view)?.net).toEqual([]);
				const after = (await reloaded.model.snapshot()).document
					.SaveGame as unknown as Save & {
					customModData: { untouched: string };
				};
				expect(after.customModData.untouched).toBe("007");
				expect(after.player.yearForSaveGame).toBe(3);
				if (!after.farmhands) throw Error("Missing preserved farmhand");
				expect(after.farmhands[0]?.yearForSaveGame).toBe(3);
			} finally {
				await reloaded.close();
			}
		} finally {
			await opened.close();
		}
	});
});
