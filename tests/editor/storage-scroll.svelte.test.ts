import { fireEvent, render } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import { exportDocument, fixtureXml, parser } from "./fixtures";
import StorageHarness from "./StorageHarness.svelte";
import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";

it(
	"scrolls a held Storage drag at pane edges and cancels without editing the save",
	{ timeout: 20000 },
	async () => {
		const document = parser.parse(fixtureXml);
		const wood = createCatalogItem("Wood");
		if (!wood) throw new Error("Missing Wood fixture item");
		// One placed chest gives the actual Storage panel an occupied drag source;
		// viewport geometry is supplied below because the DOM runner does not lay out CSS.
		Object.assign(document.SaveGame, {
			locations: {
				GameLocation: [
					{
						name: "Farm",
						objects: {
							item: [
								{
									key: { Vector2: { X: 1, Y: 2 } },
									value: {
										Object: {
											"@_xsi:type": "Chest",
											playerChest: true,
											name: "Supplies",
											itemId: "130",
											specialChestType: "None",
											items: { Item: [wood] },
										},
									},
								},
							],
						},
					},
				],
			},
		});
		const opened = await openEditor(
			SaveProcessingSync,
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(StorageHarness, { model: opened.model });
		const source = page.getByRole("button", { name: "Slot 1: Wood" });
		const pane = source.closest<HTMLDivElement>(".containers");
		if (!pane) throw new Error("Missing Storage scroll pane");
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
		const pageScroll = vi
			.spyOn(window, "scrollBy")
			.mockImplementation(() => {});
		const hit = vi
			.spyOn(globalThis.document, "elementFromPoint")
			.mockReturnValue(source);
		const rect = vi
			.spyOn(pane, "getBoundingClientRect")
			.mockReturnValue(new DOMRect(0, 300, 600, 400));
		vi.stubGlobal("innerHeight", 900);
		pane.style.overflowY = "auto";
		Object.defineProperties(pane, {
			clientHeight: { configurable: true, value: 400 },
			scrollHeight: { configurable: true, value: 1200 },
		});
		pane.scrollTop = 200;
		try {
			const before = await opened.model.snapshot();
			await fireEvent.pointerDown(source, {
				pointerId: 12,
				pointerType: "touch",
				clientX: 30,
				clientY: 450,
			});
			await fireEvent.pointerMove(source, {
				pointerId: 12,
				pointerType: "touch",
				clientX: 30,
				clientY: 310,
			});
			// Both pane edges are far from the viewport edges. This proves the pane's
			// own bounds drive scrolling rather than the old viewport-only threshold.
			expect(schedule).toHaveBeenCalled();
			if (!frame) throw new Error("Missing held-drag animation frame");
			frame(0);
			expect(pane.scrollTop).toBeLessThan(200);
			const afterUp = pane.scrollTop;
			await fireEvent.pointerMove(source, {
				pointerId: 12,
				pointerType: "touch",
				clientX: 30,
				clientY: 690,
			});
			frame(16);
			expect(pane.scrollTop).toBeGreaterThan(afterUp);
			expect(pageScroll).not.toHaveBeenCalled();
			await fireEvent.pointerCancel(source, {
				pointerId: 12,
				pointerType: "touch",
			});
			expect(cancel).toHaveBeenCalledWith(42);
			const scheduleCount = schedule.mock.calls.length;
			const cancelledPosition = pane.scrollTop;
			// Even a callback already dequeued when cancellation arrived must stop
			// without scrolling again or leaving another animation frame scheduled.
			frame(32);
			expect(schedule).toHaveBeenCalledTimes(scheduleCount);
			expect(pane.scrollTop).toBe(cancelledPosition);
			const after = await opened.model.snapshot();
			expect(after.entries).toHaveLength(0);
			expect(after.document).toEqual(before.document);
		} finally {
			page.unmount();
			hit.mockRestore();
			rect.mockRestore();
			pageScroll.mockRestore();
			schedule.mockRestore();
			cancel.mockRestore();
			vi.unstubAllGlobals();
			await opened.close();
		}
	},
);
