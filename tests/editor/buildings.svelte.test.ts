import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import { inspectBuildings } from "../../src/lib/editor/building-data";
import { fixtureXml } from "./fixtures";
import {
	withAnimalBuildings,
	COOP_ANIMALS,
	COOP_ID,
} from "../helpers/animalBuildings";
import CharacterHarness from "./CharacterHarness.svelte";

// Exercise real field lifetimes and discrete transactions through the workspace,
// rather than reproducing the domain implementation in a component mock.
it(
	"groups animal typing, edits outside residents and applies upgrade/adoption with Undo",
	{ timeout: 30000 },
	async () => {
		const opened = await openEditor(
			new TextEncoder().encode(withAnimalBuildings(fixtureXml)),
		);
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Buildings & animals" }),
			);
			const nav = await page.findByRole("navigation", { name: "Buildings" });
			await fireEvent.click(
				within(nav).getByRole("button", { name: /^Coop / }),
			);
			const card = within(page.getByRole("article", { name: "Clucky animal" }));
			const input = card.getByRole("textbox", {
				name: "Name",
			}) as HTMLInputElement;
			input.focus();
			await fireEvent.input(input, { target: { value: "P" } });
			await fireEvent.input(input, { target: { value: "Poppy" } });
			input.blur();
			await waitFor(async () => {
				expect((await opened.model.snapshot()).entries).toHaveLength(1);
				expect(
					inspectBuildings(
						(await opened.model.snapshot()).document,
					).animals.find((row) => row.id === COOP_ANIMALS.clucky)?.raw?.name,
				).toBe("Poppy");
			});
			await opened.model.commands.undo();
			await waitFor(() => expect(input.value).toBe("Clucky"));
			const outside = within(
				page.getByRole("article", { name: "Wanderer animal" }),
			);
			expect(outside.getByText(/Outside/)).toBeTruthy();
			const happiness = outside.getByRole("spinbutton", {
				name: "Happiness",
			}) as HTMLInputElement;
			happiness.focus();
			await fireEvent.input(happiness, { target: { value: "250" } });
			happiness.blur();
			await waitFor(async () =>
				expect(
					inspectBuildings(
						(await opened.model.snapshot()).document,
					).animals.find((row) => row.id === COOP_ANIMALS.wanderer)?.raw
						?.happiness,
				).toBe(250),
			);
			await fireEvent.change(
				page.getByRole("combobox", { name: "Building tier" }),
				{ target: { value: "Big Coop" } },
			);
			// Selecting a tier is a consequence draft: it must not change the save until Apply.
			expect(
				inspectBuildings(
					(await opened.model.snapshot()).document,
				).buildings.find((row) => row.id === COOP_ID)?.raw.buildingType,
			).toBe("Coop");
			await fireEvent.click(page.getByRole("button", { name: "Apply tier" }));
			await waitFor(() =>
				expect(page.getByRole("heading", { name: "Big Coop" })).toBeTruthy(),
			);
			const adoption = within(
				page.getByRole("form", { name: "Adopt an animal" }),
			);
			await fireEvent.change(
				adoption.getByRole("combobox", { name: "Animal type" }),
				{ target: { value: "Duck" } },
			);
			await fireEvent.input(
				adoption.getByRole("textbox", { name: "New animal name" }),
				{ target: { value: "Puddles" } },
			);
			await fireEvent.click(
				adoption.getByRole("button", { name: "Adopt animal" }),
			);
			await page.findByRole("article", { name: "Puddles animal" });
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page.queryByRole("article", { name: "Puddles animal" }),
				).toBeNull(),
			);
			await opened.model.commands.redo();
			await page.findByRole("article", { name: "Puddles animal" });
			// Navigation retains the selected building while ending any active field gesture.
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			await fireEvent.click(
				page.getByRole("link", { name: "Buildings & animals" }),
			);
			expect(page.getByRole("heading", { name: "Big Coop" })).toBeTruthy();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
