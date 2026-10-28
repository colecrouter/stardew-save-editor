import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import type { SaveDocument } from "../../src/lib/editor/domain";
import CharacterHarness from "./CharacterHarness.svelte";
import { parser, fixtureXml, exportDocument } from "./fixtures";

const committed = (check: () => Promise<void>) =>
	waitFor(check, { timeout: 5000 });
async function open(mutate: (document: SaveDocument) => void = () => {}) {
	const document = parser.parse(fixtureXml);
	mutate(document);
	const opened = await openEditor(
		new TextEncoder().encode(exportDocument(document)),
	);
	const page = render(CharacterHarness, { model: opened.model });
	await fireEvent.click(page.getByRole("link", { name: "Character" }));
	return {
		...opened,
		page,
		dispose: async () => {
			page.unmount();
			await opened.close();
		},
	};
}
const rawFarmer = (document: SaveDocument) =>
	document.SaveGame.player as unknown as Record<string, unknown>;

// Whole-save commands verify that immediate controls publish only the requested
// progression fields and retain unrecognized profession IDs and stat payloads.
describe("character progression controls", { timeout: 25000 }, () => {
	it("commits rapid XP and level edits independently, preserves focus, and undoes without blur", async () => {
		const opened = await open();
		try {
			const before = (await opened.model.snapshot()).document;
			const xp = opened.page.getByRole("spinbutton", {
				name: "Farming XP",
			}) as HTMLInputElement;
			xp.focus();
			await fireEvent.input(xp, { target: { value: "380" } });
			await fireEvent.input(xp, { target: { value: "770" } });
			await committed(async () =>
				expect(
					rawFarmer((await opened.model.snapshot()).document).farmingLevel,
				).toBe(3),
			);
			expect(document.activeElement).toBe(xp);
			expect(
				(
					opened.page.getByRole("spinbutton", {
						name: "Farming level",
					}) as HTMLInputElement
				).value,
			).toBe("3");
			const count = (await opened.model.snapshot()).entries.length;
			await fireEvent.input(xp, { target: { value: "" } });
			expect(xp.value).toBe("");
			expect((await opened.model.snapshot()).entries).toHaveLength(count);
			await opened.model.commands.undo();
			await waitFor(() => expect(xp.value).toBe("380"));
			await opened.model.commands.redo();
			await waitFor(() => expect(xp.value).toBe("770"));
			await fireEvent.input(
				opened.page.getByRole("spinbutton", { name: "Farming level" }),
				{ target: { value: "5" } },
			);
			await committed(async () => {
				const farmer = rawFarmer((await opened.model.snapshot()).document);
				expect(farmer.farmingLevel).toBe(5);
				expect((farmer.experiencePoints as { int: number[] }).int[0]).toBe(
					2150,
				);
			});
			await opened.model.commands.undo();
			await opened.model.commands.undo();
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			await opened.dispose();
		}
	});

	it("shows profession branches and cascades removal while preserving unknown imported choices", async () => {
		const opened = await open((document) => {
			rawFarmer(document).professions = { int: [99, 1, 4, 99] };
		});
		try {
			const before = (await opened.model.snapshot()).document;
			const tiller = opened.page.getByRole("checkbox", {
				name: "Tiller",
			}) as HTMLInputElement;
			expect(tiller.checked).toBe(true);
			expect(
				(
					opened.page.getByRole("checkbox", {
						name: "Artisan",
					}) as HTMLInputElement
				).checked,
			).toBe(true);
			expect(
				(
					opened.page.getByRole("checkbox", {
						name: "Coopmaster",
					}) as HTMLInputElement
				).disabled,
			).toBe(true);
			await fireEvent.click(tiller);
			await committed(async () =>
				expect(
					rawFarmer((await opened.model.snapshot()).document).professions,
				).toEqual({ int: [99, 99] }),
			);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before);
			await fireEvent.click(
				opened.page.getByRole("checkbox", { name: "Rancher" }),
			);
			await waitFor(() =>
				expect(
					(
						opened.page.getByRole("checkbox", {
							name: "Coopmaster",
						}) as HTMLInputElement
					).disabled,
				).toBe(false),
			);
			await fireEvent.click(
				opened.page.getByRole("checkbox", { name: "Coopmaster" }),
			);
			await committed(async () =>
				expect(
					(
						rawFarmer((await opened.model.snapshot()).document).professions as {
							int: number[];
						}
					).int,
				).toEqual([99, 1, 4, 99, 0, 2]),
			);
		} finally {
			await opened.dispose();
		}
	});

	it("guards claimed mastery XP and targets the selected farmer through immediate edits and navigation", async () => {
		const opened = await open((document) => {
			const farmer = rawFarmer(document);
			farmer.stats = {
				Values: {
					item: [
						{ key: { string: "MasteryExp" }, value: { unsignedInt: 25000 } },
						{
							key: { string: "MasteryLevelsSpent" },
							value: { unsignedInt: 2 },
						},
						{
							key: { string: "opaque" },
							value: { unsignedInt: 7 },
							modded: "007",
						},
					],
				},
			};
			const guest = structuredClone(document.SaveGame.player);
			guest.UniqueMultiplayerID = "guest";
			guest.name = "Guest";
			document.SaveGame.farmhands = { Farmer: [guest] };
		});
		try {
			const before = (await opened.model.snapshot()).document;
			const mastery = opened.page.getByRole("spinbutton", {
				name: "Mastery XP",
			}) as HTMLInputElement;
			expect(mastery.min).toBe("25000");
			await fireEvent.input(mastery, { target: { value: "100" } });
			await waitFor(() =>
				expect(mastery.getAttribute("aria-invalid")).toBe("true"),
			);
			expect((await opened.model.snapshot()).document).toEqual(before);
			// Correcting a rejected field back to its committed value clears feedback
			// without manufacturing another saved change or Undo step.
			await fireEvent.input(mastery, { target: { value: "25000" } });
			await waitFor(() =>
				expect(mastery.getAttribute("aria-invalid")).toBeNull(),
			);
			expect((await opened.model.snapshot()).document).toEqual(before);
			await fireEvent.input(mastery, { target: { value: "45000" } });
			await waitFor(() =>
				expect(opened.page.getByText("Level 3 / 5")).toBeTruthy(),
			);
			await fireEvent.input(
				opened.page.getByRole("spinbutton", { name: "Fishing XP" }),
				{ target: { value: "10000" } },
			);
			await committed(async () =>
				expect(
					rawFarmer((await opened.model.snapshot()).document).fishingLevel,
				).toBe(9),
			);

			const farmerSelect = opened.page.getByRole("combobox", {
				name: "Farmer",
			}) as HTMLSelectElement;
			// Happy DOM does not match selected options with :checked, which
			// Svelte's binding uses. Supply that one native selector result only;
			// the actual change event still runs the application binding.
			farmerSelect.value = "1";
			const selection = vi
				.spyOn(farmerSelect, "querySelector")
				.mockReturnValueOnce(farmerSelect.options[1]!);
			await fireEvent.change(farmerSelect);
			selection.mockRestore();

			await waitFor(() =>
				expect(
					(
						opened.page.getByRole("spinbutton", {
							name: "Fishing XP",
						}) as HTMLInputElement
					).value,
				).toBe("114"),
			);
			await committed(async () =>
				expect(
					rawFarmer((await opened.model.snapshot()).document).fishingLevel,
				).toBe(9),
			);
			await fireEvent.click(
				opened.page.getByRole("link", { name: "Date and weather" }),
			);
			await fireEvent.click(
				opened.page.getByRole("link", { name: "Character" }),
			);
			expect(
				(
					opened.page.getByRole("spinbutton", {
						name: "Fishing XP",
					}) as HTMLInputElement
				).value,
			).toBe("114");
			await opened.model.commands.undo();
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			await opened.dispose();
		}
	});
});
