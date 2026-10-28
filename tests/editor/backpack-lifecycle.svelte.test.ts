import { describe, expect, it } from "vitest";
import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { Result } from "effect";
import { openEditor } from "../../src/lib/editor/editor-model";
import { catalogEntries } from "../../src/lib/editor/item-catalog";
import BackpackHarness from "./BackpackHarness.svelte";
import { fixtureXml, parser, exportDocument } from "./fixtures";

// Real full-save copies and export parsing need a bounded integration budget on CI.
describe("backpack catalog workflow", { timeout: 25_000 }, () => {
	it("browses without writes, adds to the chosen empty slot, and follows add/remove through undo and redo", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const original = parser.parse(fixtureXml);
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 4: Empty" }),
			);
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search items" }),
				{ target: { value: "(O)388" } },
			);
			await fireEvent.click(
				page.getByRole("button", { name: "Preview Wood ((O)388)" }),
			);
			// Filtering and previewing must not allocate save identities or history.
			expect((await opened.model.snapshot()).document).toEqual(original);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
			await fireEvent.click(
				page.getByRole("button", { name: "Add to slot 4" }),
			);
			await waitFor(
				() =>
					expect(
						page.getByRole("region", { name: "Selected backpack item" }),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			const expected = structuredClone(original);
			const wood = catalogEntries.find((entry) => entry.id === "Wood");
			if (!wood) throw Error("Expected the Wood catalog entry");
			expected.SaveGame.player.items.Item[3] = structuredClone(
				wood.raw,
			) as never;
			expect((await opened.model.snapshot()).document).toEqual(expected);
			expect(
				page
					.getByRole("button", { name: "Slot 4: Wood" })
					.getAttribute("aria-pressed"),
			).toBe("true");
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page.getByRole("region", { name: "Add backpack item" }),
				).toBeTruthy(),
			);
			expect((await opened.model.snapshot()).document).toEqual(original);
			await opened.model.commands.redo();
			await waitFor(() =>
				expect(page.getByRole("heading", { name: "Wood" })).toBeTruthy(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Remove item" }));
			await waitFor(
				() =>
					expect(
						page.getByRole("region", { name: "Add backpack item" }),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(page.getByRole("heading", { name: "Wood" })).toBeTruthy(),
			);
			expect((await opened.model.snapshot()).document).toEqual(expected);
			// Validate the actual encoded/reparsed document, including all untouched fields.
			const exported = await opened.model.commands.export();
			if (!exported || Result.isFailure(exported))
				throw Error("Expected successful export");
			// XML has no primitive string/number distinction for a numeric item ID.
			// Account for that new-record representation without relaxing equality
			// for any imported part of the document.
			const serializedExpected = structuredClone(expected);
			(
				serializedExpected.SaveGame.player.items.Item[3] as Record<
					string,
					unknown
				>
			).itemId = 388;
			expect(parser.parse(new TextDecoder().decode(exported.success))).toEqual(
				serializedExpected,
			);
		} finally {
			page.unmount();
			await opened.close();
		}
	});

	it("removes an opaque imported item and restores its complete data on undo", async () => {
		const original = parser.parse(fixtureXml);
		original.SaveGame.player.items.Item[3] = {
			"@_xsi:type": "ModdedItem",
			itemId: "mod.example",
			name: "Opaque keepsake",
			stack: 7,
			custom: { "@_version": "2", nested: [{ value: 0 }, { value: false }] },
		} as never;
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(original)),
		);
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = (await opened.model.snapshot()).document;
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 4: Opaque keepsake" }),
			);
			const selected = within(
				page.getByRole("region", { name: "Selected backpack item" }),
			);
			expect(selected.queryByRole("spinbutton")).toBeNull();
			await fireEvent.click(
				selected.getByRole("button", { name: "Remove item" }),
			);
			await waitFor(
				() =>
					expect(
						page.getByRole("region", { name: "Add backpack item" }),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page.getByRole("heading", { name: "Opaque keepsake" }),
				).toBeTruthy(),
			);
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			page.unmount();
			await opened.close();
		}
	});
});
