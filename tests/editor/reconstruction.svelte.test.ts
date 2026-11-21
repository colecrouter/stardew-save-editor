import { fireEvent, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";

import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderTestWorkspace } from "./workspace.ts";

it("follows the reconstruction guide to edit a crop shipment and inspect saved object tiles", async () => {
	const document = tinyEditorFixture();
	// An empty collection is a valid starting point for a new farm. The placed
	// object uses a saved tile key so the inspector can report its coordinates.
	document.SaveGame.player.basicShipped = [];
	document.SaveGame.locations = [
		{
			$type: "StardewValley.Farm",
			name: "Farm",
			objects: [
				{
					key: { X: 4, Y: 7 },
					value: {
						$type: "StardewValley.Object",
						name: "Stone",
						itemId: "390",
					},
				},
			],
		},
		{ $type: "StardewValley.Locations.FarmHouse", name: "FarmHouse" },
	];
	const opened = await renderTestWorkspace(document, "Reconstruct a farm");
	try {
		const { model, page } = opened;
		const calendarDone = () =>
			page.getByRole("checkbox", {
				name: "Mark Date and weather done",
			});
		await fireEvent.click(calendarDone());
		await fireEvent.click(
			page.getByRole("button", { name: "Date and weather" }),
		);
		expect(page.getByText(/host’s days-played statistic/)).toBeTruthy();
		await fireEvent.click(
			page.getByRole("link", { name: "Reconstruct a farm" }),
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
		await fireEvent.click(page.getByRole("link", { name: "Locations" }));
		expect(page.getByRole("cell", { name: "4, 7" })).toBeTruthy();
		expect(page.getByRole("cell", { name: "Stone" })).toBeTruthy();
		await waitFor(async () => {
			expect(
				(await model.snapshot()).document.SaveGame.player.basicShipped,
			).toEqual([{ key: "24", value: 15 }]);
		});
	} finally {
		await opened.dispose();
	}
});
