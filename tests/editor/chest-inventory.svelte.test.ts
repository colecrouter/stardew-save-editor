import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import BackpackHarness from "./BackpackHarness.svelte";
import { exportDocument, fixtureXml, parser } from "./fixtures";

// Use production XML and actual app subscriptions: chest slots are session views
// over compact lists, so assertions exercise publication rather than local grids.
function chestFixture() {
	const document = parser.parse(fixtureXml);
	const game = document.SaveGame as unknown as Record<string, unknown>;
	game.locations = {
		GameLocation: [
			{
				name: "Farm",
				objects: {
					item: [
						{
							key: { Vector2: { X: 4, Y: 8 } },
							value: {
								Object: {
									"@_xsi:type": "Chest",
									name: "Chest",
									itemId: "130",
									playerChest: true,
									items: { Item: [createCatalogItem("Wood")] },
								},
							},
						},
					],
				},
			},
			{
				name: "Town",
				objects: {
					item: [
						{
							key: { Vector2: { X: 10, Y: 12 } },
							value: {
								Object: {
									"@_xsi:type": "Chest",
									name: "Big Chest",
									itemId: "BigChest",
									playerChest: true,
									specialChestType: "BigChest",
									items: "",
								},
							},
						},
					],
				},
			},
		],
	};
	return exportDocument(document);
}
function dragData() {
	const values = new Map<string, string>();
	return {
		types: ["application/x-stardew-backpack-item"],
		setData: (key: string, value: string) => values.set(key, value),
		getData: (key: string) => values.get(key) ?? "",
		effectAllowed: "",
		dropEffect: "",
	};
}
async function drag(source: HTMLElement, target: HTMLElement) {
	const dataTransfer = dragData();
	await fireEvent.dragStart(source, { dataTransfer });
	await fireEvent.dragOver(target, { dataTransfer });
	await fireEvent.drop(target, { dataTransfer });
}

describe("placed chest inventory controls", { timeout: 25_000 }, () => {
	it("edits and drags between a chest and backpack while selection follows Undo", async () => {
		const opened = await openEditor(new TextEncoder().encode(chestFixture()));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			expect(
				page.getByRole("region", { name: "Test's backpack" }),
			).toBeTruthy();
			expect(
				page.getByRole("region", { name: "Chest inventory" }).textContent,
			).toContain("Farm");
			await fireEvent.click(
				page.getByRole("button", { name: "Chest slot 1: Wood" }),
			);
			const quantity = page.getByRole("spinbutton", { name: "Quantity" });
			await fireEvent.focus(quantity);
			await fireEvent.input(quantity, { target: { value: "2" } });
			await fireEvent.input(quantity, { target: { value: "9" } });
			// Chest quantity uses the same grouped field policy as backpacks. The
			// following transfer queues after these writes and retains their old owner.
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			await waitFor(() =>
				expect(
					(
						page.getByRole("spinbutton", {
							name: "Quantity",
						}) as HTMLInputElement
					).value,
				).toBe("9"),
			);
			await drag(
				page.getByRole("button", { name: "Chest slot 1: Wood" }),
				page.getByRole("button", { name: "Slot 4: Empty" }),
			);
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Slot 4: Wood" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			expect(
				(page.getByRole("spinbutton", { name: "Quantity" }) as HTMLInputElement)
					.value,
			).toBe("9");
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Chest slot 1: Wood" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					(
						page.getByRole("spinbutton", {
							name: "Quantity",
						}) as HTMLInputElement
					).value,
				).toBe("1"),
			);
			await opened.model.commands.redo();
			await waitFor(() =>
				expect(
					(
						page.getByRole("spinbutton", {
							name: "Quantity",
						}) as HTMLInputElement
					).value,
				).toBe("9"),
			);
		} finally {
			page.unmount();
			await opened.close();
		}
	});

	it("finds chests by location and reuses the catalog/removal inspector for virtual slots", async () => {
		const opened = await openEditor(new TextEncoder().encode(chestFixture()));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Find a chest" }),
				{ target: { value: "Town" } },
			);
			expect(
				page.getByRole("region", { name: "Chest inventory" }).textContent,
			).toContain("70 slots");
			expect(
				page.queryByRole("button", { name: "Chest slot 1: Wood" }),
			).toBeNull();
			await fireEvent.click(
				page.getByRole("button", { name: "Chest slot 70: Empty" }),
			);
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search items" }),
				{ target: { value: "Parsnip" } },
			);
			await fireEvent.click(
				page.getByRole("button", {
					name: "Preview Parsnip ((O)24)",
				}),
			);
			await fireEvent.click(
				page.getByRole("button", { name: "Add to slot 70" }),
			);
			// The game stores a compact list: adding through a virtual empty slot
			// returns the new identity after it settles into the first real position.
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Chest slot 1: Parsnip" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			await fireEvent.click(page.getByRole("button", { name: "Remove item" }));
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Chest slot 1: Empty" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Chest slot 1: Parsnip" })
						.getAttribute("aria-pressed"),
				).toBe("true"),
			);
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Find a chest" }),
				{ target: { value: "not a location" } },
			);
			expect(
				page.getByRole("region", { name: "Chest inventory" }).textContent,
			).toContain("No chests match");
		} finally {
			page.unmount();
			await opened.close();
		}
	});
	it("scrolls held touch drags at the viewport edge and cancels the frame without writes", async () => {
		const opened = await openEditor(new TextEncoder().encode(chestFixture()));
		const page = render(BackpackHarness, { model: opened.model });
		let frame: FrameRequestCallback | undefined;
		const schedule = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((callback) => {
				frame = callback;
				return 42;
			});
		const cancel = vi
			.spyOn(window, "cancelAnimationFrame")
			.mockImplementation(() => {});
		const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
		const source = page.getByRole("button", { name: "Chest slot 1: Wood" });
		const hit = vi.spyOn(document, "elementFromPoint").mockReturnValue(source);
		try {
			await fireEvent.pointerDown(source, {
				pointerId: 12,
				pointerType: "touch",
				clientX: 30,
				clientY: 140,
			});
			await fireEvent.pointerMove(source, {
				pointerId: 12,
				pointerType: "touch",
				clientX: 30,
				clientY: 5,
			});
			expect(schedule).toHaveBeenCalled();
			frame?.(0);
			expect(scroll).toHaveBeenCalledWith(0, expect.any(Number));
			expect(scroll.mock.calls[0]?.[1]).toBeLessThan(0);
			await fireEvent.pointerCancel(source, {
				pointerId: 12,
				pointerType: "touch",
			});
			expect(cancel).toHaveBeenCalledWith(42);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
			// Destruction also owns cleanup if the view disappears mid-gesture.
			await fireEvent.pointerDown(source, {
				pointerId: 13,
				pointerType: "touch",
				clientX: 30,
				clientY: 140,
			});
			await fireEvent.pointerMove(source, {
				pointerId: 13,
				pointerType: "touch",
				clientX: 30,
				clientY: 5,
			});
			cancel.mockClear();
			page.unmount();
			expect(cancel).toHaveBeenCalledWith(42);
		} finally {
			page.unmount();
			hit.mockRestore();
			scroll.mockRestore();
			schedule.mockRestore();
			cancel.mockRestore();
			await opened.close();
		}
	});
});
