import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import BackpackHarness from "./BackpackHarness.svelte";
import { exportDocument, fixtureXml, parser } from "./fixtures";

function dragData() {
	const values = new Map<string, string>();
	return {
		types: ["application/x-stardew-backpack-item"],
		setData: (type: string, value: string) => values.set(type, value),
		getData: (type: string) => values.get(type) ?? "",
		effectAllowed: "",
		dropEffect: "",
	};
}
async function drag(source: HTMLElement, target: HTMLElement) {
	const dataTransfer = dragData();
	await fireEvent.dragStart(source, { dataTransfer });
	// Native HTML dragging cancels the preceding mouse pointer stream. That event
	// must not clear the drag state owned by DragEvent rather than touch/pen.
	await fireEvent.pointerCancel(source, { pointerType: "mouse" });
	await fireEvent.dragOver(target, { dataTransfer });
	await fireEvent.drop(target, { dataTransfer });
}

// Exercise the same native drag path for positional and named equipment slots.
// Full-save copies and export projections need a bounded CI integration budget.
describe("inventory drag and equipment controls", { timeout: 25_000 }, () => {
	it("shows equipment beside the backpack and moves/swaps through dragging without Move mode", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = await opened.model.snapshot();
			expect(
				page.getByRole("heading", { name: "Inventory", level: 1 }),
			).toBeTruthy();
			expect(
				page.getByRole("region", { name: "Test's equipment" }),
			).toBeTruthy();
			expect(page.getByRole("button", { name: "Shirt: Shirt" })).toBeTruthy();
			await fireEvent.click(
				page.getByRole("button", { name: "Trinket: Empty" }),
			);
			expect(
				page.getByRole("region", { name: "Empty equipment slot" }).textContent,
			).toContain("locked");
			expect(
				page.queryByRole("region", { name: "Add backpack item" }),
			).toBeNull();
			expect(page.queryByRole("button", { name: "Move item" })).toBeNull();
			expect(
				page.queryByRole("region", { name: "Move backpack item" }),
			).toBeNull();
			await drag(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
				page.getByRole("button", { name: "Slot 4: Empty" }),
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
			await waitFor(() =>
				expect(document.activeElement).toBe(
					page.getByRole("button", { name: "Slot 4: Parsnip" }),
				),
			);
			await opened.model.commands.undo();
			await drag(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
				page.getByRole("button", { name: "Slot 2: Pickaxe" }),
			);
			await waitFor(
				() =>
					expect(
						page.getByRole("button", { name: "Slot 2: Parsnip" }),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.items.Item[4],
			).toEqual(before.document.SaveGame.player.items.Item[1]);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			page.unmount();
			await opened.close();
		}
	});
	it("equips boots by dragging, follows selection across equipment Undo/Redo, and rejects incompatible equipment", async () => {
		const document = parser.parse(fixtureXml);
		const boots = createCatalogItem("Sneakers");
		if (!boots) throw Error("Expected catalog boots");
		document.SaveGame.player.items.Item[3] = boots;
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = await opened.model.snapshot();
			await drag(
				page.getByRole("button", { name: "Slot 4: Sneakers" }),
				page.getByRole("button", { name: "Boots: Empty" }),
			);
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Boots: Sneakers" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			expect(
				page.getByRole("region", { name: "Selected equipment item" }),
			).toBeTruthy();
			expect(page.queryByRole("button", { name: "Remove item" })).toBeNull();
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Slot 4: Sneakers" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await opened.model.commands.redo();
			await waitFor(() =>
				expect(
					page.getByRole("button", { name: "Boots: Sneakers" }),
				).toBeTruthy(),
			);
			const equipped = await opened.model.snapshot();
			await drag(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
				page.getByRole("button", { name: "Hat: Empty" }),
			);
			await waitFor(
				() =>
					expect(
						page.getByText(/cannot|compatible|hat/i, {
							selector: ".operation-error",
						}),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			expect((await opened.model.snapshot()).document).toEqual(
				equipped.document,
			);
			await drag(
				page.getByRole("button", { name: "Shirt: Shirt" }),
				page.getByRole("button", { name: "Pants: Farmer Pants" }),
			);
			await waitFor(
				() =>
					expect(
						page.getByText(/cannot|compatible|pants/i, {
							selector: ".operation-error",
						}),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			expect((await opened.model.snapshot()).document).toEqual(
				equipped.document,
			);
		} finally {
			page.unmount();
			await opened.close();
		}
	});
	it("uses touch pointer dragging without Move mode and cancels interrupted gestures without writes", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		const hit = vi.spyOn(document, "elementFromPoint");
		try {
			const source = page.getByRole("button", { name: "Slot 5: Parsnip" });
			const target = page.getByRole("button", { name: "Slot 4: Empty" });
			hit.mockReturnValue(target);
			await fireEvent.pointerDown(source, {
				pointerId: 7,
				pointerType: "touch",
				clientX: 10,
				clientY: 10,
			});
			await fireEvent.pointerMove(source, {
				pointerId: 7,
				pointerType: "touch",
				clientX: 70,
				clientY: 10,
			});
			await fireEvent.pointerUp(source, {
				pointerId: 7,
				pointerType: "touch",
				clientX: 70,
				clientY: 10,
			});
			await fireEvent.click(source, { detail: 1 });
			await waitFor(
				() =>
					expect(
						page
							.getByRole("button", { name: "Slot 4: Parsnip" })
							.getAttribute("aria-pressed"),
					).toBe("true"),
				{ timeout: 5000 },
			);
			const moved = await opened.model.snapshot();
			expect(moved.entries).toHaveLength(1);
			const nextSource = page.getByRole("button", { name: "Slot 4: Parsnip" });
			hit.mockReturnValue(page.getByRole("button", { name: "Slot 7: Empty" }));
			await fireEvent.pointerDown(nextSource, {
				pointerId: 8,
				pointerType: "touch",
				clientX: 10,
				clientY: 10,
			});
			await fireEvent.pointerMove(nextSource, {
				pointerId: 8,
				pointerType: "touch",
				clientX: 90,
				clientY: 10,
			});
			await fireEvent.pointerCancel(nextSource, {
				pointerId: 8,
				pointerType: "touch",
			});
			await fireEvent.pointerUp(nextSource, {
				pointerId: 8,
				pointerType: "touch",
				clientX: 90,
				clientY: 10,
			});
			expect((await opened.model.snapshot()).document).toEqual(moved.document);
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
		} finally {
			hit.mockRestore();
			page.unmount();
			await opened.close();
		}
	});

	it("ignores outside drops and preserves add/remove selection lineage through drag Undo", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const before = (await opened.model.snapshot()).document;
			await fireEvent.drop(
				page.getByRole("button", { name: "Slot 4: Empty" }),
				{ dataTransfer: dragData() },
			);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
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
			await drag(
				page.getByRole("button", { name: "Slot 4: Wood" }),
				page.getByRole("button", { name: "Slot 7: Empty" }),
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
