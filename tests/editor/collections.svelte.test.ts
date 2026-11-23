import { fireEvent, waitFor, within } from "@testing-library/svelte";
import { expect, it } from "vitest";

import catalog from "../../generated/progress.json";
import { requireInstance } from "../helpers/assertions.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderTestWorkspace } from "./workspace.ts";

it("summarizes the complete catalog, filters records and keeps other shipments read-only and outside the total", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.basicShipped = [
		{ key: "24", value: 0 },
		{ key: "128", value: 9 },
		{ key: "Mod.Crop", value: 11 },
		{ key: "Mod.Crop", value: 13 },
	];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		await fireEvent.click(
			page.getByRole("tab", { name: "Shipping collection" }),
		);
		const collection = within(
			page.getByRole("region", { name: "Shipping collection" }),
		);
		expect(
			collection.getByText(`1 / ${catalog.shipping.length} recorded`),
		).toBeTruthy();
		expect(collection.getAllByRole("spinbutton")).toHaveLength(24);
		await fireEvent.change(
			collection.getByRole("combobox", { name: "Show collection items" }),
			{ target: { value: "recorded" } },
		);
		expect(collection.getAllByRole("spinbutton")).toHaveLength(1);
		expect(
			collection.getByRole("spinbutton", { name: "Parsnip shipped count" }),
		).toHaveProperty("value", "0");
		await fireEvent.click(collection.getByText("Other recorded shipments (3)"));
		expect(collection.getByText("Pufferfish")).toBeTruthy();
		expect(collection.getAllByText("Item ID: Mod.Crop")).toHaveLength(2);
		expect(collection.getByText("11 shipped")).toBeTruthy();
		expect(collection.getByText("13 shipped")).toBeTruthy();
		await fireEvent.input(
			collection.getByRole("searchbox", { name: "Find a shipping item" }),
			{ target: { value: "Mod.Crop" } },
		);
		expect(collection.queryAllByRole("spinbutton")).toHaveLength(0);
		expect(
			collection.getByText(
				"No collection items match. Try another name or filter.",
			),
		).toBeTruthy();
		expect(collection.getAllByText("Item ID: Mod.Crop")).toHaveLength(2);
		expect((await model.snapshot()).entries).toHaveLength(0);
	} finally {
		await opened.dispose();
	}
});

it("retains an edited missing fish until blur and updates the summary through Undo", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.fishCaught = [];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Fishing" }));
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Find a fish" }),
			{ target: { value: "128" } },
		);
		const filter = page.getByRole("combobox", {
			name: "Show collection items",
		});
		await fireEvent.change(filter, { target: { value: "missing" } });
		const input = requireInstance(
			page.getByRole("spinbutton", { name: "Pufferfish catch count" }),
			HTMLInputElement,
		);
		input.focus();
		await fireEvent.input(input, { target: { value: "1" } });
		await waitFor(async () =>
			expect(
				(await model.snapshot()).document.SaveGame.player.fishCaught,
			).toEqual([{ key: "(O)128", value: [1, 0] }]),
		);
		expect(input.isConnected).toBe(true);
		await fireEvent.input(input, { target: { value: "15" } });
		input.blur();
		await waitFor(() =>
			expect(
				page.queryByRole("spinbutton", { name: "Pufferfish catch count" }),
			).toBeNull(),
		);
		expect(page.getByText(`1 / ${catalog.fish.length} recorded`)).toBeTruthy();
		await model.commands.undo();
		await waitFor(() =>
			expect(
				page.getByRole("spinbutton", { name: "Pufferfish catch count" }),
			).toHaveProperty("value", "0"),
		);
		expect(
			(await model.snapshot()).document.SaveGame.player.fishCaught,
		).toEqual([]);
	} finally {
		await opened.dispose();
	}
});

it("searches beyond mounted rows and restores search and filters across tabs", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.basicShipped = [];
	document.SaveGame.player.fishCaught = [];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page } = opened;
		await fireEvent.click(
			page.getByRole("tab", { name: "Shipping collection" }),
		);
		await fireEvent.click(
			page.getByRole("button", { name: /^Show more items/ }),
		);
		expect(page.getAllByRole("spinbutton")).toHaveLength(48);
		// A search must reach the full catalog, even when its card was not mounted.
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Find a shipping item" }),
			{ target: { value: "Powdermelon" } },
		);
		expect(
			page.getByRole("spinbutton", { name: "Powdermelon shipped count" }),
		).toBeTruthy();
		await fireEvent.change(
			page.getByRole("combobox", { name: "Show collection items" }),
			{ target: { value: "missing" } },
		);
		await fireEvent.click(page.getByRole("tab", { name: "Fishing" }));
		await fireEvent.click(
			page.getByRole("tab", { name: "Shipping collection" }),
		);
		expect(
			page.getByRole("searchbox", { name: "Find a shipping item" }),
		).toHaveProperty("value", "Powdermelon");
		expect(
			page.getByRole("combobox", { name: "Show collection items" }),
		).toHaveProperty("value", "missing");
	} finally {
		await opened.dispose();
	}
});
