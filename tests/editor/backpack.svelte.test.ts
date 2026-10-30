import { readItemVisual } from "../../src/lib/editor/item-presentation.ts";
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
						ownerId: String(farmer.UniqueMultiplayerID),
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
			await waitFor(async () => {
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.items.Item[
						count - 5
					],
				).toMatchObject({ stack: 18 });
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
						page.getByRole("heading", { name: /^Inventory$/ }),
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
			// Input itself publishes the edit; no Enter or blur is required.
			await waitFor(() => {
				expect(actions(page)).toBe(1);
				expect(quantity.disabled).toBe(false);
			});
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() => expect(quantity.value).toBe("1"));
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(quantity.value).toBe("12"));
			// Enter and blur after an input must not contribute duplicate actions.
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

	it("clearing and rapid valid input preserve focus and commit the latest quantity without blur", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(BackpackHarness, { model: opened.model });
		try {
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			const quantity = page.getByRole("spinbutton", {
				name: "Quantity",
			}) as HTMLInputElement;
			quantity.focus();
			// A pending valid write must not refill a subsequently cleared control.
			await fireEvent.input(quantity, { target: { value: "12" } });
			await fireEvent.input(quantity, { target: { value: "" } });
			await waitFor(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.items
						.Item[4],
				).toMatchObject({ stack: 12 }),
			);
			expect(quantity.value).toBe("");
			expect(document.activeElement).toBe(quantity);
			// Each complete input enters the queue; later text is never dropped or
			// replaced by an earlier asynchronous completion while typing continues.
			await fireEvent.input(quantity, { target: { value: "2" } });
			await fireEvent.input(quantity, { target: { value: "25" } });
			await fireEvent.input(quantity, { target: { value: "250" } });
			await waitFor(
				async () =>
					expect(
						(await opened.model.snapshot()).document.SaveGame.player.items
							.Item[4],
					).toMatchObject({ stack: 250 }),
				// Three serialized full-save copies can exceed Testing Library’s default
				// one-second wait on CI; still require the final committed document.
				{ timeout: 5000 },
			);
			expect(quantity.value).toBe("250");
			expect(document.activeElement).toBe(quantity);
			// Every valid value was applied, but the whole focus gesture is one Undo.
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			await opened.model.commands.undo();
			await waitFor(() => expect(quantity.value).toBe("1"));
			await opened.model.commands.redo();
			await waitFor(() => expect(quantity.value).toBe("250"));
			await fireEvent.input(quantity, { target: { value: "" } });
			expect(quantity.value).toBe("");
			await opened.model.commands.undo();
			await waitFor(() => expect(quantity.value).toBe("1"));
			await opened.model.commands.redo();
			await waitFor(() => expect(quantity.value).toBe("250"));
		} finally {
			page.unmount();
			await opened.close();
		}
	});

	it("custom quality stays unselected until an explicit radio choice and Undo restores it", async () => {
		const document = parser.parse(fixtureXml);
		const parsnip = document.SaveGame.player.items.Item[4] as Record<
			string,
			unknown
		>;
		parsnip.quality = 3;
		const page = await openBackpack(exportDocument(document));
		try {
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			expect(inspector(page).getByText("Current: Custom (3)")).toBeTruthy();
			expect(
				inspector(page)
					.getAllByRole("radio")
					.some((input) => (input as HTMLInputElement).checked),
			).toBe(false);
			const gold = inspector(page).getByRole("radio", {
				name: "Gold",
			}) as HTMLInputElement;
			gold.focus();
			await fireEvent.click(gold);
			await waitFor(() => expect(actions(page)).toBe(1));
			expect(globalThis.document.activeElement).toBe(gold);
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() =>
				expect(inspector(page).getByText("Current: Custom (3)")).toBeTruthy(),
			);
			expect(
				inspector(page)
					.getAllByRole("radio")
					.some((input) => (input as HTMLInputElement).checked),
			).toBe(false);
		} finally {
			page.unmount();
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
			await waitFor(() => expect(quantity.value).toBe("1"));
			expect(inspector(page).getByRole("status").textContent).toMatch(
				/quantity from 1 to 9999/,
			);
			expect(actions(page)).toBe(0);
			// Correcting to the committed value clears rejected feedback without an edit.
			await fireEvent.input(quantity, { target: { value: "1" } });
			await waitFor(() =>
				expect(quantity.getAttribute("aria-invalid")).toBeNull(),
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
				inspector(page).queryByRole("group", { name: "Quality" }),
			).toBeNull();
			await fireEvent.click(
				page.getByRole("button", { name: "Slot 4: Unknown custom item" }),
			);
			expect(inspector(page).getByText("Quantity: 7")).toBeTruthy();
			expect(inspector(page).getByText("Quality: 3")).toBeTruthy();
			expect(inspector(page).queryByRole("spinbutton")).toBeNull();
			expect(inspector(page).queryByRole("radio")).toBeNull();
			expect(actions(page)).toBe(0);
		} finally {
			page.unmount();
		}
	});
});

it("projected backpack visuals resolve missing display names without adding or normalizing saved fields", () => {
	const raw = Object.freeze({
		"@_xsi:type": "Object",
		itemId: "388",
		quality: 3,
	});
	const before = structuredClone(raw);
	const page = render(BackpackItemVisual, { visual: readItemVisual(raw) });
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
		const page = render(BackpackItemVisual, { visual: readItemVisual(raw) });
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

// Clothes must show the saved dye immediately without filling missing save fields.
it.each(["shirtItem", "pantsItem"] as const)(
	"previews saved %s color without normalizing the record",
	(key) => {
		const document = parser.parse(fixtureXml);
		const raw = Object.freeze({
			...(document.SaveGame.player[key] as Record<string, unknown>),
			clothesColor: Object.freeze({
				R: 18,
				G: 32,
				B: 64,
				A: 128,
				custom: "retain",
			}),
		});
		const before = structuredClone(raw);
		const page = render(BackpackItemVisual, { visual: readItemVisual(raw) });
		try {
			flushSync();
			expect(page.container.querySelectorAll("svg image").length).toBe(
				key === "shirtItem" ? 2 : 1,
			);
			const matrix = page.container
				.querySelector("feColorMatrix")
				?.getAttribute("values")
				?.split(" ")
				.map(Number);
			expect(matrix?.[0]).toBeCloseTo(18 / 255);
			expect(matrix?.[6]).toBeCloseTo(32 / 255);
			expect(matrix?.[12]).toBeCloseTo(64 / 255);
			expect(matrix?.[18]).toBeCloseTo(128 / 255);
			expect(raw).toEqual(before);
		} finally {
			page.unmount();
		}
	},
);
