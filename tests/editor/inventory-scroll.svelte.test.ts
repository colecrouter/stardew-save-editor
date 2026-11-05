import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import BackpackHarness from "./BackpackHarness.svelte";
import { fixtureXml } from "./fixtures";

// DOM scroll state tests complement browser geometry measurements: selection
// resets only its own detail viewport, while revisions preserve reading position.
it(
	"starts new slot details at the top without resetting inventory scroll or reading position on edits",
	{ timeout: 15000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const inspector = page.getByRole("group", {
				name: "Selected slot details",
			});
			const possessions = page.container.querySelector(".possessions");
			if (!(possessions instanceof HTMLElement))
				throw new Error("Missing inventory pane");
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 4: Empty" }),
			);
			inspector.scrollTop = 260;
			possessions.scrollTop = 100;
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			expect(inspector.scrollTop).toBe(0);
			expect(possessions.scrollTop).toBe(100);
			inspector.scrollTop = 120;
			await fireEvent.input(
				page.getByRole("spinbutton", { name: "Quantity" }),
				{ target: { value: "18" } },
			);
			await waitFor(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.items
						.Item[4],
				).toMatchObject({ stack: 18 }),
			);
			expect(inspector.scrollTop).toBe(120);
			expect(possessions.scrollTop).toBe(100);
			await fireEvent.click(page.getByRole("button", { name: "Hat: Empty" }));
			expect(inspector.scrollTop).toBe(0);
			expect(possessions.scrollTop).toBe(100);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

// The broad hit-test root contains the scrollable slot pane. A held finger must
// scroll that descendant at its own edge, without moving the page when saturated.
it(
	"edge-scrolls the inventory pane inside the drag root and cancels cleanly",
	{ timeout: 15000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
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
		const source = page.getByRole("button", { name: "Slot 5: Parsnip" });
		const hit = vi.spyOn(document, "elementFromPoint").mockReturnValue(source);
		const pane = page.container.querySelector(".possessions");
		if (!(pane instanceof HTMLElement))
			throw new Error("Missing inventory pane");
		pane.style.overflowY = "auto";
		const bounds = vi
			.spyOn(pane, "getBoundingClientRect")
			.mockReturnValue(new DOMRect(0, 200, 300, 300));
		let top = 0;
		Object.defineProperty(pane, "scrollTop", {
			configurable: true,
			get: () => top,
			set: (value: number) => {
				top = Math.max(0, Math.min(100, value));
			},
		});
		try {
			await fireEvent.pointerDown(source, {
				pointerId: 28,
				pointerType: "touch",
				clientX: 30,
				clientY: 300,
			});
			await fireEvent.pointerMove(source, {
				pointerId: 28,
				pointerType: "touch",
				clientX: 30,
				clientY: 490,
			});
			expect(frame).toBeDefined();
			frame?.(0);
			expect(top).toBeGreaterThan(0);
			expect(scroll).not.toHaveBeenCalled();
			top = 100;
			frame?.(1);
			expect(top).toBe(100);
			expect(scroll).not.toHaveBeenCalled();
			await fireEvent.pointerCancel(source, {
				pointerId: 28,
				pointerType: "touch",
			});
			expect(cancel).toHaveBeenCalledWith(42);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
		} finally {
			page.unmount();
			bounds.mockRestore();
			hit.mockRestore();
			scroll.mockRestore();
			schedule.mockRestore();
			cancel.mockRestore();
			await opened.close();
		}
	},
);
