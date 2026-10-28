import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { flushSync } from "svelte";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import BackpackItemVisual from "../../src/lib/editor/ui/BackpackItemVisual.svelte";
import { openEditor } from "../../src/lib/editor/editor-model";
import BackpackHarness from "./BackpackHarness.svelte";
import { exportDocument, fixtureXml, parser } from "./fixtures";

// Exercise the app-owned lazy panel with real full-save commands and export.
// The complete fixture needs the same bounded CI budget as other workflow suites.
describe("full-save backpack workflow", { timeout: 15_000 }, () => {
	it("initial and explicit selections follow their entity through reorder and undo", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			const document = parser.parse(fixtureXml);
			const farmer = document.SaveGame.player;
			const count = farmer.items.Item.length;
			const reorder = () =>
				opened.model.commands.execute([
					{
						type: "reorder",
						farmerId: String(farmer.UniqueMultiplayerID),
						order: farmer.items.Item.map((_, index) => count - 1 - index),
					},
				]);
			const selected = () =>
				within(page.getByRole("region", { name: "Selected backpack item" }));
			// The first item must become an entity selection even before a click;
			// choosing the current first slot on every revision would retarget it.
			expect(
				selected().getByRole("heading", { name: "Rusty Sword" }),
			).toBeTruthy();
			await reorder();
			await waitFor(() =>
				expect(selected().getByText(`Slot ${count}`)).toBeTruthy(),
			);
			expect(
				selected().getByRole("heading", { name: "Rusty Sword" }),
			).toBeTruthy();
			await opened.model.commands.undo();
			await waitFor(() => expect(selected().getByText("Slot 1")).toBeTruthy());
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			await reorder();
			await waitFor(() =>
				expect(selected().getByText(`Slot ${count - 4}`)).toBeTruthy(),
			);
			expect(selected().getByRole("heading", { name: "Parsnip" })).toBeTruthy();
			const quantity = selected().getByRole("spinbutton", {
				name: "Quantity",
			}) as HTMLInputElement;
			await fireEvent.input(quantity, { target: { value: "18" } });
			await fireEvent.blur(quantity);
			await waitFor(() => {
				expect(quantity.value).toBe("18");
				expect(quantity.disabled).toBe(false);
			});
			// Inspect the committed save, not only optimistic input text: the edit
			// must reach Parsnip's moved slot while the sword remains untouched.
			const snapshot = await opened.model.snapshot();
			expect(
				snapshot.document.SaveGame.player.items.Item[count - 5],
			).toMatchObject({ name: "Parsnip", stack: 18 });
			expect(
				snapshot.document.SaveGame.player.items.Item[count - 1],
			).toMatchObject({ name: "Rusty Sword", stack: 1 });
			await opened.model.commands.undo();
			await opened.model.commands.undo();
			await waitFor(() => expect(selected().getByText("Slot 5")).toBeTruthy());
			expect(selected().getByRole("heading", { name: "Parsnip" })).toBeTruthy();
			expect(quantity.value).toBe("1");
		} finally {
			// Release consumers before the file scope disposes their borrowed registry.
			page.unmount();
			await opened.close();
		}
	});
	async function openBackpack(xml = fixtureXml) {
		const page = render(EditorApp);
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([xml], "Farm_123")] },
			});
			await waitFor(
				() =>
					expect(page.getByRole("link", { name: "Inventory" })).toBeTruthy(),
				{ timeout: 5000 },
			);
			await fireEvent.click(page.getByRole("link", { name: "Inventory" }));
			await waitFor(
				() =>
					expect(
						page.getByRole("heading", { name: /^Backpack$/ }),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			return page;
		} catch (error) {
			page.unmount();
			throw error;
		}
	}
	type Page = Awaited<ReturnType<typeof openBackpack>>;
	const actions = (page: Page) =>
		page.container.querySelector("ol")?.children.length ?? 0;
	const inspector = (page: Page) =>
		within(page.getByRole("region", { name: "Selected backpack item" }));

	it("quantity and quality commit independently, undo/redo, and export only the intended item fields", async () => {
		let written: Blob | undefined;
		const picker = vi.fn(async () => ({
			createWritable: async () => ({
				write: async (blob: Blob) => {
					written = blob;
				},
				close: async () => {},
			}),
		}));
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		});
		const page = await openBackpack();
		try {
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			const quantity = inspector(page).getByRole("spinbutton", {
				name: "Quantity",
			}) as HTMLInputElement;
			const quality = (name: string) =>
				inspector(page).getByRole("radio", { name }) as HTMLInputElement;
			expect(quality("Silver").checked).toBe(true);
			// Every supported tier is labeled; custom value 3 is never silently mapped.
			expect(
				inspector(page)
					.getAllByRole("radio")
					.map((input) => (input as HTMLInputElement).value),
			).toEqual(["0", "1", "2", "4"]);
			expect(
				page.queryByRole("button", { name: /Apply.*(?:item|inventory)/i }),
			).toBeNull();
			quantity.focus();
			await fireEvent.input(quantity, { target: { value: "12" } });
			expect(actions(page)).toBe(0);
			await fireEvent.blur(quantity);
			await waitFor(() => {
				expect(actions(page)).toBe(1);
				expect(quantity.disabled).toBe(false);
			});
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() => expect(quantity.value).toBe("1"));
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(quantity.value).toBe("12"));
			// A completed Enter edit followed by blur must contribute one action.
			await fireEvent.input(quantity, { target: { value: "13" } });
			await fireEvent.keyDown(quantity, { key: "Enter", code: "Enter" });
			await waitFor(() => {
				expect(actions(page)).toBe(2);
				expect(quantity.disabled).toBe(false);
			});
			await fireEvent.blur(quantity);
			expect(actions(page)).toBe(2);
			await fireEvent.click(quality("Iridium"));
			await waitFor(() => {
				expect(actions(page)).toBe(3);
				expect(quality("Iridium").disabled).toBe(false);
			});
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() => expect(quality("Silver").checked).toBe(true));
			expect(quantity.value).toBe("13");
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(quality("Iridium").checked).toBe(true));
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(() => expect(written).toBeTruthy(), { timeout: 5000 });
			if (!written)
				throw Error("Expected the browser writer to receive the save");
			const expected = parser.parse(fixtureXml);
			const item = expected.SaveGame.player.items.Item[4] as
				| Record<string, unknown>
				| undefined;
			if (!item) throw Error("Expected the fixture Parsnip");
			item.stack = 13;
			item.quality = 4;
			// Whole-document equality also protects base price, edibility, other
			// items, and opaque records from incidental proxy normalization.
			expect(parser.parse(await written.text())).toEqual(expected);
			expect(picker).toHaveBeenCalledOnce();
		} finally {
			page.unmount();
			Reflect.deleteProperty(window, "showSaveFilePicker");
		}
	});

	it("invalid quantity restores the committed value, selection survives navigation, and tools/unknown items stay read-only", async () => {
		const document = parser.parse(fixtureXml);
		// Keep an unresolved mod item in a real slot to check the fallback without
		// requiring catalog metadata or constructing a legacy item proxy.
		document.SaveGame.player.items.Item[3] = {
			"@_xsi:type": "ModdedItem",
			name: "Unknown custom item",
			itemId: "example.custom",
			stack: 7,
			quality: 3,
		};
		const page = await openBackpack(exportDocument(document));
		try {
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			const quantity = inspector(page).getByRole("spinbutton", {
				name: "Quantity",
			}) as HTMLInputElement;
			await fireEvent.input(quantity, { target: { value: "0" } });
			await fireEvent.blur(quantity);
			await waitFor(() => expect(quantity.value).toBe("1"));
			expect(inspector(page).getByRole("status").textContent).toMatch(
				/quantity from 1 to 9999/,
			);
			expect(actions(page)).toBe(0);
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			await fireEvent.click(page.getByRole("link", { name: "Inventory" }));
			expect(
				page
					.getByRole("button", { name: "Slot 5: Parsnip" })
					.getAttribute("aria-pressed"),
			).toBe("true");
			await fireEvent.click(
				page.getByRole("button", { name: /Slot 2: .*Pickaxe/ }),
			);
			expect(
				inspector(page).queryByRole("spinbutton", { name: "Quantity" }),
			).toBeNull();
			expect(
				inspector(page).queryByRole("combobox", { name: "Quality" }),
			).toBeNull();
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 4: Unknown custom item" }),
			);
			expect(inspector(page).getByText("Quantity: 7")).toBeTruthy();
			expect(inspector(page).getByText("Quality: 3")).toBeTruthy();
			expect(inspector(page).queryByRole("spinbutton")).toBeNull();
			expect(inspector(page).queryByRole("combobox")).toBeNull();
			expect(actions(page)).toBe(0);
		} finally {
			page.unmount();
		}
	});
});

it("raw backpack visuals resolve missing display names without adding or normalizing saved fields", () => {
	const raw = Object.freeze({
		"@_xsi:type": "Object",
		itemId: "388",
		quality: 3,
	});
	const before = structuredClone(raw);
	const page = render(BackpackItemVisual, { raw });
	try {
		flushSync();
		expect(page.container.querySelector("svg image")).toBeTruthy();
		expect(raw).toEqual(before);
		expect(Object.hasOwn(raw, "name")).toBe(false);
		expect(Object.hasOwn(raw, "stack")).toBe(false);
	} finally {
		page.unmount();
	}
});

// Badge rendering must recognize only game tiers and leave imported custom values intact.
it.each([0, 1, 2, 3, 4])(
	"shows a quality badge only for recognized star tier %s",
	(quality) => {
		const raw = Object.freeze({
			"@_xsi:type": "Object",
			itemId: "24",
			quality,
		});
		const page = render(BackpackItemVisual, { raw });
		try {
			flushSync();
			expect(page.container.querySelector(".quality-badge svg") !== null).toBe(
				[1, 2, 4].includes(quality),
			);
			expect(raw.quality).toBe(quality);
		} finally {
			page.unmount();
		}
	},
);
