import { fireEvent, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";

import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderTestWorkspace } from "./workspace.ts";

it("follows the reconstruction guide to edit a crop shipment in the public editor", async () => {
	const document = tinyEditorFixture();
	// An empty collection is a valid starting point for a new farm.
	document.SaveGame.player.basicShipped = [];
	const opened = await renderTestWorkspace(document, "Rebuild lost progress");
	try {
		const { model, page } = opened;
		expect(page.queryByRole("link", { name: "Locations" })).toBeNull();
		expect(page.queryByRole("option", { name: "Locations" })).toBeNull();
		const calendarDone = () =>
			page.getByRole("checkbox", {
				name: "Mark Date and weather done",
			});
		await fireEvent.click(calendarDone());
		await fireEvent.click(
			page.getByRole("button", { name: "Date and weather" }),
		);
		expect(page.getByText(/days-played statistic/)).toBeTruthy();
		await fireEvent.click(
			page.getByRole("link", { name: "Rebuild lost progress" }),
		);
		expect(
			page.getByRole("checkbox", {
				name: "Mark Date and weather done",
				checked: true,
			}),
		).toBeTruthy();
		expect((await model.snapshot()).entries).toHaveLength(0);
		await fireEvent.click(page.getByRole("button", { name: "Progress" }));
		await fireEvent.click(page.getByRole("tab", { name: "Crop shipments" }));
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Find a crop" }),
			{
				target: { value: "Parsnip" },
			},
		);
		await fireEvent.input(
			page.getByRole("spinbutton", { name: "Parsnip shipped count" }),
			{
				target: { value: "15" },
			},
		);
		await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
		await waitFor(async () => {
			expect(
				(await model.snapshot()).document.SaveGame.player.basicShipped,
			).toEqual([{ key: "24", value: 15 }]);
		});
	} finally {
		await opened.dispose();
	}
});
