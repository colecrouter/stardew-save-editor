import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import { readChests } from "../../src/lib/editor/inventory-views";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import { fixtureXml, parser, exportDocument } from "./fixtures";
import StorageHarness from "./StorageHarness.svelte";

it(
	"searches across chests, picks eligible items and changes quality with one Undo",
	{ timeout: 20000 },
	async () => {
		const document = parser.parse(fixtureXml);
		const item = (name: string) => {
			const value = createCatalogItem(name);
			if (!value) throw new Error("Missing fixture item");
			return value;
		};
		// Add deterministic placed storage without relying on the public fixture's
		// ordinary chest contents or on raw references after the editor takes ownership.
		const chest = (name: string, items: unknown[]) => ({
			"@_xsi:type": "Chest",
			playerChest: true,
			name,
			itemId: "130",
			specialChestType: "None",
			items: { Item: items },
		});
		const locations = document.SaveGame.locations;
		if (
			!locations ||
			typeof locations !== "object" ||
			!("GameLocation" in locations) ||
			!Array.isArray(locations.GameLocation)
		)
			throw new Error("Missing fixture locations");
		const farm = locations.GameLocation.find(
			(value: unknown) =>
				value &&
				typeof value === "object" &&
				"name" in value &&
				value.name === "Farm",
		);
		if (!farm || typeof farm !== "object")
			throw new Error("Missing fixture farm");
		Object.assign(farm, {
			objects: {
				item: [
					chest("Apple Storage", [item("Parsnip"), item("Wood")]),
					chest("Berry Storage", [item("Parsnip")]),
				].map((raw, index) => ({
					key: { Vector2: { X: index, Y: 0 } },
					value: { Object: raw },
				})),
			},
		});
		const opened = await openEditor(
				new TextEncoder().encode(exportDocument(document)),
			),
			page = render(StorageHarness, { model: opened.model });
		try {
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search stored items" }),
				{ target: { value: "Parsnip" } },
			);
			expect(
				page.getAllByRole("button", { name: "Slot 1: Parsnip" }),
			).toHaveLength(2);
			await fireEvent.click(
				page.getByRole("checkbox", { name: "Select multiple items" }),
			);
			for (const control of page.getAllByRole("button", {
				name: "Slot 1: Parsnip",
			}))
				await fireEvent.click(control);
			expect(page.getByText("2 selected")).toBeTruthy();
			await fireEvent.click(page.getByRole("button", { name: "Gold" }));
			await waitFor(async () =>
				expect(
					readChests(await opened.model.snapshot())
						.filter(
							(owner) =>
								owner.name.includes("Apple Storage") ||
								owner.name.includes("Berry Storage"),
						)
						.map((owner) => owner.slots[0]?.quality),
				).toEqual([2, 2]),
			);
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			await opened.model.commands.undo();
			await waitFor(async () =>
				expect(
					readChests(await opened.model.snapshot())
						.filter(
							(owner) =>
								owner.name.includes("Apple Storage") ||
								owner.name.includes("Berry Storage"),
						)
						.map((owner) => owner.slots[0]?.quality),
				).toEqual([0, 0]),
			);
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search stored items" }),
				{ target: { value: "Wood" } },
			);
			expect(page.queryByText("2 selected")).toBeNull();
			expect(page.getAllByRole("button", { name: "Organize" })).toHaveLength(1);
			// A mixed selection must not leave the deselected item's inspector active.
			await fireEvent.click(page.getByRole("button", { name: "Slot 2: Wood" }));
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search stored items" }),
				{ target: { value: "" } },
			);
			const parsnip = page.getAllByRole("button", {
				name: "Slot 1: Parsnip",
			})[0];
			if (!parsnip) throw new Error("Missing selection fixture");
			await fireEvent.click(parsnip);
			await fireEvent.click(parsnip);
			expect(
				page
					.getByRole("button", { name: "Slot 2: Wood" })
					.getAttribute("aria-pressed"),
			).toBe("true");
			expect(
				page.queryByRole("region", { name: "Selected chest item" }),
			).toBeNull();
			await fireEvent.click(
				page.getByRole("checkbox", { name: "Select multiple items" }),
			);
			await fireEvent.click(
				page.getByRole("button", { name: "Clear selection" }),
			);
			expect(
				page.getByRole("region", { name: "Selected chest item" }),
			).toBeTruthy();
			expect(page.getByRole("heading", { name: "Wood" })).toBeTruthy();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
