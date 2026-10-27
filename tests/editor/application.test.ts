import { expect, it } from "vitest";
import { Effect, Result } from "effect";
import { get } from "svelte/store";
import { openEditor, editorResources } from "../../src/lib/editor/editor-model";
import {
	setCalendarDate,
	setCalendarWeather,
} from "../../src/lib/editor/calendar-operations";
import { fixtureXml, parser, exportDocument } from "./fixtures";
import type { Save } from "../../codegen/save";

const bytes = (xml: string) => new TextEncoder().encode(xml);

it("the application calendar preserves unsupported inventory and bundle data without constructing those features", async () => {
	const document = parser.parse(fixtureXml);
	const raw = document.SaveGame as unknown as Record<string, unknown>;
	delete raw.bundleData;
	raw.player = { ...(raw.player as object), items: { moddedInventory: "007" } };
	raw.modData = { untouched: ["0007", { nested: "opaque" }] };
	const opened = await openEditor(bytes(exportDocument(document)));
	try {
		expect(get(opened.model.view)?.net).toEqual([]);
		expect(get(opened.model.view)?.bundle.supported).toBe(false);
		const result = await opened.model.commands.transact(
			setCalendarDate({ year: 3 }),
		);
		expect(result && Result.isSuccess(result)).toBe(true);
		const after = await opened.model.snapshot();
		expect(
			(after.document.SaveGame as unknown as Record<string, unknown>).modData,
		).toEqual(raw.modData);
		expect(after.document.SaveGame.player.items).toEqual(
			document.SaveGame.player.items,
		);
		await opened.model.commands.undo();
		expect((await opened.model.snapshot()).document).toEqual(document);
	} finally {
		await opened.close();
	}
	expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });
});

it("the application validates exact exported bytes and blocks existing definite errors without mutating the baseline", async () => {
	const document = parser.parse(fixtureXml);
	document.SaveGame.player.money = 3_000_000_000;
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
	document.SaveGame.farmhands = {
		Farmer: [
			{
				...structuredClone(document.SaveGame.player),
				UniqueMultiplayerID: "guest",
				name: "Guest",
			},
		],
	};
	Object.assign(game, { modData: { untouched: "007" } });
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
				.SaveGame as unknown as Save & { modData: { untouched: string } };
			expect(after.modData.untouched).toBe("007");
			expect(after.player.yearForSaveGame).toBe(3);
			if (!after.farmhands) throw Error("Missing preserved farmhand");
			expect(after.farmhands.Farmer[0]?.yearForSaveGame).toBe(3);
		} finally {
			await reloaded.close();
		}
	} finally {
		await opened.close();
	}
});
