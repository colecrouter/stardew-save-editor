import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import BackpackHarness from "./BackpackHarness.svelte";
import { exportDocument, fixtureXml, parser } from "./fixtures";

// These interactions run through the real queue and full-save projections. The
// larger farmhand fixture needs a bounded CI budget for copies and Undo history.
describe("backpack moving and swapping controls", { timeout: 25_000 }, () => {
	it("moves and swaps through visible destination controls without merging quantities, and Cancel leaves history unchanged", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = await opened.model.snapshot();
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			await fireEvent.click(page.getByRole("button", { name: "Move item" }));
			// The retained panel must not consume Escape while another workspace
			// section is active and this subtree is hidden.
			page.container.hidden = true;
			await fireEvent.keyDown(window, { key: "Escape" });
			expect(
				page.container.querySelector('[aria-label="Move backpack item"]'),
			).toBeTruthy();
			page.container.hidden = false;
			await fireEvent.click(page.getByRole("button", { name: "Cancel move" }));
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
			expect(document.activeElement).toBe(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			await fireEvent.click(page.getByRole("button", { name: "Move item" }));
			await fireEvent.click(
				page.getByRole("button", { name: "Move Parsnip to slot 4: Empty" }),
			);
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Slot 4: Parsnip" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			expect(document.activeElement).toBe(
				page.getByRole("button", { name: "Slot 4: Parsnip" }),
			);
			const moved = await opened.model.snapshot();
			expect(moved.document.SaveGame.player.items.Item[3]).toEqual(
				before.document.SaveGame.player.items.Item[4],
			);
			expect(moved.document.SaveGame.player.items.Item[4]).toEqual(
				before.document.SaveGame.player.items.Item[3],
			);
			expect(moved.entries).toHaveLength(1);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Slot 5: Parsnip" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			await fireEvent.click(page.getByRole("button", { name: "Move item" }));
			await fireEvent.click(
				page.getByRole("button", { name: "Swap Parsnip with slot 2: Pickaxe" }),
			);
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Slot 2: Parsnip" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			const swapped = await opened.model.snapshot();
			expect(swapped.document.SaveGame.player.items.Item[1]).toEqual(
				before.document.SaveGame.player.items.Item[4],
			);
			expect(swapped.document.SaveGame.player.items.Item[4]).toEqual(
				before.document.SaveGame.player.items.Item[1],
			);
			expect(swapped.entries).toHaveLength(1);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			page.unmount();
			await opened.close();
		}
	});

	it("targets the last slot of a larger farmhand backpack and follows the selected item across owner Undo/Redo", async () => {
		const document = parser.parse(fixtureXml);
		const host = document.SaveGame.player;
		const guest = structuredClone(host);
		guest.UniqueMultiplayerID = "guest";
		guest.name = "Guest";
		guest.items.Item = Array.from({ length: 36 }, () => ({
			"@_xsi:nil": "true",
		}));
		guest.items.Item[35] = structuredClone(host.items.Item[0]);
		const unsupported = structuredClone(guest);
		unsupported.UniqueMultiplayerID = "unsupported";
		unsupported.name = "Unsupported";
		unsupported.items = "ModdedInventory" as never;
		document.SaveGame.farmhands = { Farmer: [guest, unsupported] };
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = await opened.model.snapshot();
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			await fireEvent.click(page.getByRole("button", { name: "Move item" }));
			const select = page.getByRole("combobox", {
				name: "Destination backpack",
			}) as HTMLSelectElement;
			// Happy DOM only matches inputs for :checked; Svelte's native select
			// binding needs the selected OPTION. The actual browser is checked too.
			expect(
				(
					page.getByRole("option", {
						name: "Unsupported (unavailable)",
					}) as HTMLOptionElement
				).disabled,
			).toBe(true);
			const query = select.querySelector.bind(select);
			const mock = vi
				.spyOn(select, "querySelector")
				.mockImplementation((selector) =>
					selector === ":checked"
						? ([...select.options].find((option) => option.selected) ?? null)
						: query(selector),
				);
			try {
				await fireEvent.change(select, { target: { value: "1" } });
			} finally {
				mock.mockRestore();
			}
			expect(page.getByText(/36 slots in Guest/)).toBeTruthy();
			await fireEvent.click(
				page.getByRole("button", {
					name: "Swap Parsnip with slot 36: Rusty Sword",
				}),
			);
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Slot 36: Parsnip" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			const after = await opened.model.snapshot();
			if (
				after.document.SaveGame.farmhands === "" ||
				before.document.SaveGame.farmhands === ""
			)
				throw Error("Expected farmhand fixture");
			expect(
				after.document.SaveGame.farmhands.Farmer[0]?.items.Item[35],
			).toEqual(before.document.SaveGame.player.items.Item[4]);
			expect(after.document.SaveGame.player.items.Item[4]).toEqual(
				before.document.SaveGame.farmhands.Farmer[0]?.items.Item[35],
			);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Slot 5: Parsnip" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await opened.model.commands.redo();
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Slot 36: Parsnip" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
		} finally {
			page.unmount();
			await opened.close();
		}
	});

	it("accepts an in-panel drag and ignores unrelated drops", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = await opened.model.snapshot();
			const values = new Map<string, string>();
			const dataTransfer = {
				types: ["application/x-stardew-backpack-item"],
				setData: (type: string, value: string) => values.set(type, value),
				getData: (type: string) => values.get(type) ?? "",
				effectAllowed: "",
				dropEffect: "",
			};
			await fireEvent.drop(
				page.getByRole("button", { name: "Slot 4: Empty" }),
				{ dataTransfer },
			);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
			await fireEvent.dragStart(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
				{ dataTransfer },
			);
			const target = page.getByRole("button", {
				name: "Move Parsnip to slot 4: Empty",
			});
			await fireEvent.dragOver(target, { dataTransfer });
			await fireEvent.drop(target, { dataTransfer });
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Slot 4: Parsnip" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.items.Item[3],
			).toEqual(before.document.SaveGame.player.items.Item[4]);
		} finally {
			page.unmount();
			await opened.close();
		}
	});
	it("retains an added item's selection lineage through move Undo and creation Undo", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = (await opened.model.snapshot()).document;
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 4: Empty" }),
			);
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search items" }),
				{ target: { value: "(O)388" } },
			);
			await fireEvent.click(
				page.getByRole("button", { name: "Add to slot 4" }),
			);
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Slot 4: Wood" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			await fireEvent.click(page.getByRole("button", { name: "Move item" }));
			await fireEvent.click(
				page.getByRole("button", { name: "Move Wood to slot 7: Empty" }),
			);
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Slot 7: Wood" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			await opened.model.commands.undo();
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page.getByRole("region", { name: "Add backpack item" }),
				).toBeTruthy(),
			);
			expect(
				page
					.getByRole("button", { name: "Slot 4: Empty" })
					.getAttribute("aria-pressed"),
			).toBe("true");
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			page.unmount();
			await opened.close();
		}
	});
});
