import { describe, expect, it } from "vitest";
import { fixtureXml } from "./fixtures";
import { get } from "svelte/store";
import { createDraft } from "../../src/lib/editor/field.ts";
import {
	editorResources,
	formatDateDraft,
	openEditor as openApplicationEditor,
} from "../../src/lib/editor/editor-model.ts";
import { exportDocument, parser, tinyFixture } from "./fixtures";
import type { Save } from "../../codegen/save.ts";

const openEditor = (
	bytes: Uint8Array,
	limits: import("../../src/lib/editor/history.ts").HistoryLimits = {},
) =>
	openApplicationEditor(bytes, limits, {
		includeProofs: true,
		validateExport: false,
	});

const input = async () => new TextEncoder().encode(fixtureXml);
const parseBytes = (bytes: Uint8Array) =>
	parser.parse(new TextDecoder().decode(bytes));

// TestSave is a 6.6 MB preservation fixture. Encoding/reparsing it several times
// verifies data integrity, not latency; retain the experiment's integration budget
// on shared CI runners without changing the default timeout for unit tests.
describe("full-save calendar session", { timeout: 15_000 }, () => {
	it("calendar import/view/export preserves the full document before any edit", async () => {
		const bytes = await input();
		const opened = await openEditor(bytes);
		try {
			expect(get(opened.model.view)?.net).toEqual([]);
			expect(parseBytes(await opened.model.export())).toEqual(
				parseBytes(bytes),
			);
			expect(get(opened.model.view)?.entries).toEqual([]);
		} finally {
			await opened.close();
		}
		expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });
	});

	it("date drafts survive external changes and undo until an explicit reload", async () => {
		const opened = await openEditor(await input());
		const draft = createDraft(opened.model.dateField);
		const stop = draft.subscribe(() => {});
		try {
			const before = await opened.model.snapshot();
			draft.input(
				formatDateDraft({ year: 3, season: "spring" as never, day: 8 }),
			);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await opened.model.execute([
				{ type: "calendar-date", change: { day: 9 } },
			]);
			expect(get(draft).conflict).toBe(true);
			await draft.submit();
			expect(get(opened.model.view)?.calendar.date.day).toBe(9);
			await opened.model.undo();
			expect(get(draft).dirty).toBe(true);
			expect(get(draft).conflict).toBe(true);
			draft.reload();
			draft.input(
				formatDateDraft({ year: 3, season: "spring" as never, day: 8 }),
			);
			await draft.submit();
			expect(get(draft).dirty).toBe(false);
			expect(get(opened.model.view)?.calendar.date).toEqual({
				year: 3,
				season: "spring",
				day: 8,
			});
		} finally {
			stop();
			await opened.close();
		}
	});

	it("an invalid or failed compound edit preserves document, domain state, redo and draft text", async () => {
		const opened = await openEditor(await input());
		const draft = createDraft(opened.model.dateField);
		const stop = draft.subscribe(() => {});
		try {
			await opened.model.execute([
				{ type: "calendar-date", change: { day: 8 } },
			]);
			await opened.model.undo();
			const before = await opened.model.snapshot();
			draft.input(JSON.stringify({ year: "", season: "spring", day: "8" }));
			await draft.submit();
			expect(get(draft).dirty).toBe(true);
			expect(get(draft).error).not.toBe("");
			await expect(
				opened.model.execute([
					{ type: "calendar-date", change: { day: 8 } },
					{ type: "calendar-weather", day: "today", value: "not-allowed" },
				]),
			).rejects.toThrow();
			expect(await opened.model.snapshot()).toEqual(before);
		} finally {
			stop();
			await opened.close();
		}
	});

	it("export queues behind commits and stale concurrent drafts cannot overwrite them", async () => {
		const opened = await openEditor(await input());
		try {
			const edit = opened.model.execute([
				{ type: "calendar-date", change: { year: 5, day: 8 } },
			]);
			const exported = opened.model.export();
			await edit;
			expect(
				(parseBytes(await exported).SaveGame as unknown as Save).year,
			).toBe(5);
			const revision = get(opened.model.view)?.revision;
			const results = await Promise.allSettled([
				opened.model.execute(
					[{ type: "calendar-date", change: { day: 9 } }],
					revision,
				),
				opened.model.execute(
					[{ type: "calendar-date", change: { day: 10 } }],
					revision,
				),
			]);
			expect(results.map((result) => result.status)).toEqual([
				"fulfilled",
				"rejected",
			]);
			expect(get(opened.model.view)?.calendar.date.day).toBe(9);
		} finally {
			await opened.close();
		}
	});

	it("compact reorder history remains inspectable after exported changes return to baseline", async () => {
		const opened = await openEditor(await input());
		try {
			const view = get(opened.model.view);
			if (!view) throw new Error("Missing editor view");
			const reverse = {
				type: "reorder",
				farmerId: view.farmerId,
				order: Array.from(
					{ length: view.backpackSize },
					(_, i) => view.backpackSize - i - 1,
				),
			} as const;
			await opened.model.execute([reverse]);
			expect(get(opened.model.view)?.net.length).toBeGreaterThan(0);
			await opened.model.execute([reverse]);
			expect(get(opened.model.view)?.net).toEqual([]);
			expect(get(opened.model.view)?.entries).toHaveLength(2);
			expect(
				get(opened.model.view)?.entries.every((entry) => entry.compact),
			).toBe(true);
		} finally {
			await opened.close();
		}
	});

	it("net review survives history eviction and a remounted Atom consumer reads current values", async () => {
		const opened = await openEditor(await input(), { entries: 1 });
		try {
			const stop = opened.model.view.subscribe(() => {});
			stop();
			await opened.model.execute([
				{ type: "calendar-date", change: { year: 4, day: 8 } },
			]);
			await opened.model.execute([
				{ type: "calendar-date", change: { day: 9 } },
			]);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(get(opened.model.view)?.calendar.date).toEqual({
				year: 4,
				season: "spring",
				day: 9,
			});
			expect(get(opened.model.view)?.dropped).toBe(1);
			expect(
				get(opened.model.view)?.net.some(
					(patch) => patch.path === "/SaveGame/year",
				),
			).toBe(true);
			await opened.model.undo();
			expect(get(opened.model.view)?.calendar.date.year).toBe(4);
		} finally {
			await opened.close();
		}
	});

	it("failed construction and repeated session closure release registries/streams and reject retained handles", async () => {
		const malformed = tinyFixture();
		Object.assign(malformed.SaveGame, { gameVersion: "1.6.15" });
		await expect(
			openEditor(new TextEncoder().encode(exportDocument(malformed))),
		).rejects.toThrow();
		expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });
		const bytes = await input();
		for (let i = 0; i < 4; i++) {
			const opened = await openEditor(bytes);
			const stop = opened.model.view.subscribe(() => {});
			await opened.model.execute([
				{ type: "calendar-date", change: { day: 8 } },
			]);
			stop();
			await opened.close();
			await opened.close();
			expect(get(opened.model.view)).toBeUndefined();
			expect(get(opened.model.pending)).toBe(0);
			await expect(opened.model.export()).rejects.toThrow(/closed/);
			expect(editorResources()).toEqual({
				models: 0,
				registries: 0,
				streams: 0,
			});
		}
	}, 30000);
});
