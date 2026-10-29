import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
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
	it("groups rapid XP typing into one Undo gesture while level edits remain a separate action", async () => {
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
			await waitFor(() =>
				expect(xp.value).toBe(
					String(
						(rawFarmer(before).experiencePoints as { int: number[] }).int[0],
					),
				),
			);
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

			const farmerSelect = opened.page.getByRole("combobox", {
				name: "Farmer",
			}) as HTMLSelectElement;
			// The shared selector sends stable farmer identity through the actual change
			// event, without Svelte's index-bound selected-option DOM query.
			await fireEvent.change(farmerSelect, { target: { value: "guest" } });

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
				opened.page.getByRole("link", { name: "Inventory" }),
			);
			const inventoryFarmer = (await opened.page.findByRole("combobox", {
				name: "Farmer",
			})) as HTMLSelectElement;
			// Selection is session-owned across feature pages; choosing a farmer in
			// Inventory also changes Character without retargeting the earlier edit.
			expect(inventoryFarmer.value).toBe("guest");
			await fireEvent.change(inventoryFarmer, {
				target: { value: String(before.SaveGame.player.UniqueMultiplayerID) },
			});
			await fireEvent.click(
				opened.page.getByRole("link", { name: "Character" }),
			);
			await waitFor(() =>
				expect(
					(
						opened.page.getByRole("spinbutton", {
							name: "Fishing XP",
						}) as HTMLInputElement
					).value,
				).toBe("10000"),
			);
			await opened.model.commands.undo();
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			await opened.dispose();
		}
	});
	it("filters ambiguous farmer choices and rolls back a rejected stale selection with visible feedback", async () => {
		const opened = await open((document) => {
			const guest = structuredClone(document.SaveGame.player);
			guest.UniqueMultiplayerID = "guest";
			guest.name = "Guest";
			const duplicate = structuredClone(guest);
			duplicate.UniqueMultiplayerID = "duplicate";
			duplicate.name = "Duplicate A";
			const secondDuplicate = {
				...structuredClone(duplicate),
				name: "Duplicate B",
			};
			const missing = {
				...structuredClone(guest),
				UniqueMultiplayerID: "",
				name: "Missing identity",
			};
			document.SaveGame.farmhands = {
				Farmer: [guest, duplicate, secondDuplicate, missing],
			};
		});
		try {
			const before = await opened.model.snapshot();
			const farmer = opened.page.getByRole("combobox", {
				name: "Farmer",
			}) as HTMLSelectElement;
			const hostId = String(
				before.document.SaveGame.player.UniqueMultiplayerID,
			);
			expect([...farmer.options].map((option) => option.value)).toEqual([
				hostId,
				"guest",
			]);
			expect(
				opened.page.getAllByText(
					"Farmers with missing or ambiguous identities cannot be selected.",
				),
			).toBeTruthy();
			// A stale browser option must still pass the domain command's current
			// identity checks. The portable select shares rejection/rollback behavior.
			const stale = document.createElement("option");
			stale.value = "duplicate";
			stale.textContent = "Stale farmer";
			farmer.append(stale);
			await fireEvent.change(farmer, { target: { value: "duplicate" } });
			await waitFor(() =>
				expect(farmer.getAttribute("aria-invalid")).toBe("true"),
			);
			expect(farmer.value).toBe(hostId);
			expect(
				opened.page.getByText(
					"Choose a farmer with an unambiguous saved identifier.",
				),
			).toBeTruthy();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
			await fireEvent.change(farmer, { target: { value: "guest" } });
			await waitFor(() =>
				expect(farmer.getAttribute("aria-invalid")).toBeNull(),
			);
			await waitFor(() =>
				expect(
					opened.page.getByText(
						/Edit character details, experience and professions for Guest/,
					),
				).toBeTruthy(),
			);
			await fireEvent.click(
				opened.page.getByRole("link", { name: "Inventory" }),
			);
			const inventoryFarmer = (await opened.page.findByRole("combobox", {
				name: "Farmer",
			})) as HTMLSelectElement;
			expect(inventoryFarmer.value).toBe("guest");
			expect(
				[...inventoryFarmer.options].map((option) => option.value),
			).toEqual([hostId, "guest"]);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
		} finally {
			await opened.dispose();
		}
	});
});
