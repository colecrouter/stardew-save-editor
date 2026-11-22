import { fireEvent, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";

import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderTestWorkspace } from "./workspace.ts";

it("clears imported zero-count credit directly and adds shipping credit with a positive count", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.fishCaught = [{ key: "(O)128", value: [0, 31] }];
	document.SaveGame.player.basicShipped = [{ key: "16", value: 0 }];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Fishing" }));
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Find a fish" }),
			{ target: { value: "Pufferfish" } },
		);
		const fishCredit = () =>
			page.getByRole("checkbox", { name: "Pufferfish collection credit" });
		expect(fishCredit()).toHaveProperty("checked", true);
		await fireEvent.click(fishCredit());
		await waitFor(async () =>
			expect(
				(await model.snapshot()).document.SaveGame.player.fishCaught,
			).toEqual([]),
		);
		await model.commands.undo();
		await waitFor(() => expect(fishCredit()).toHaveProperty("checked", true));
		expect(page.getByText("Saved largest size: 31")).toBeTruthy();
		await fireEvent.click(
			page.getByRole("tab", { name: "Shipping collection" }),
		);
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Find a shipping item" }),
			{ target: { value: "Wild Horseradish" } },
		);
		const shipmentCredit = () =>
			page.getByRole("checkbox", {
				name: "Wild Horseradish collection credit",
			});
		expect(shipmentCredit()).toHaveProperty("checked", true);
		await fireEvent.click(shipmentCredit());
		await waitFor(async () =>
			expect(
				(await model.snapshot()).document.SaveGame.player.basicShipped,
			).toEqual([]),
		);
		await fireEvent.click(shipmentCredit());
		await waitFor(async () =>
			expect(
				(await model.snapshot()).document.SaveGame.player.basicShipped,
			).toEqual([{ key: "16", value: 1 }]),
		);
	} finally {
		await opened.dispose();
	}
});

it("edits fishing collection credit, preserves size, and restores the record through Undo and Redo", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.fishCaught = [{ key: "(O)128", value: [4, 31] }];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Fishing" }));
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Find a fish" }),
			{ target: { value: "Pufferfish" } },
		);
		const input = () =>
			page.getByRole("spinbutton", { name: "Pufferfish catch count" });
		expect(input()).toHaveProperty("value", "4");
		expect(page.getByText("Saved largest size: 31")).toBeTruthy();
		await fireEvent.input(input(), { target: { value: "100" } });
		await fireEvent.blur(input());
		await waitFor(async () =>
			expect(
				(await model.snapshot()).document.SaveGame.player.fishCaught,
			).toEqual([{ key: "(O)128", value: [100, 31] }]),
		);
		await model.commands.undo();
		await waitFor(() => expect(input()).toHaveProperty("value", "4"));
		await model.commands.redo();
		await waitFor(() => expect(input()).toHaveProperty("value", "100"));
		await fireEvent.input(input(), { target: { value: "0" } });
		await fireEvent.blur(input());
		await waitFor(async () =>
			expect(
				(await model.snapshot()).document.SaveGame.player.fishCaught,
			).toEqual([]),
		);
		await model.commands.undo();
		await waitFor(() =>
			expect(page.getByText("Saved largest size: 31")).toBeTruthy(),
		);
	} finally {
		await opened.dispose();
	}
});

it("keeps unsupported fishing records read-only and retains search across tabs", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.fishCaught = [{ key: "(O)128", value: [4, 31, 99] }];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Fishing" }));
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Find a fish" }),
			{ target: { value: "Pufferfish" } },
		);
		expect(
			page.getByRole("spinbutton", { name: "Pufferfish catch count" }),
		).toHaveProperty("disabled", true);
		expect(
			page.getAllByText("This fish has an unsupported catch record."),
		).toHaveLength(1);
		await fireEvent.click(page.getByRole("tab", { name: "Perfection" }));
		await fireEvent.click(page.getByRole("tab", { name: "Fishing" }));
		expect(page.getByRole("searchbox", { name: "Find a fish" })).toHaveProperty(
			"value",
			"Pufferfish",
		);
		expect((await model.snapshot()).entries).toHaveLength(0);
	} finally {
		await opened.dispose();
	}
});
