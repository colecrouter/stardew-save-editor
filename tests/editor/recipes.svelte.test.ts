import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { readRecipes } from "../../src/lib/editor/recipe-operations.ts";
import CharacterHarness from "./CharacterHarness.svelte";
import { parser, fixtureXml, exportDocument } from "./fixtures.ts";

async function openRecipes() {
	const document = parser.parse(fixtureXml);
	const host = document.SaveGame.player;
	Object.assign(host, {
		cookingRecipes: {
			item: [{ key: { string: "Fried Egg" }, value: { int: 77 } }],
		},
		recipesCooked: { item: [{ key: { string: "194" }, value: { int: 5 } }] },
		craftingRecipes: {
			item: [{ key: { string: "Torch" }, value: { int: 7 } }],
		},
	});
	const guest = structuredClone(host);
	guest.UniqueMultiplayerID = "guest";
	guest.name = "Guest";
	Object.assign(guest, {
		recipesCooked: { item: [{ key: { string: "194" }, value: { int: 17 } }] },
	});
	document.SaveGame.farmhands = { Farmer: [guest] };
	const opened = await openEditor(
		new TextEncoder().encode(exportDocument(document)),
	);
	const page = render(CharacterHarness, { model: opened.model });
	await fireEvent.click(page.getByRole("link", { name: /^Recipes$/ }));
	return {
		...opened,
		page,
		hostId: String(host.UniqueMultiplayerID),
		dispose: async () => {
			page.unmount();
			await opened.close();
		},
	};
}

// Submit both keystrokes and selection before draining: queued edits must keep
// their captured owner even while the shared selector moves to another farmer.
it(
	"groups cooked counts and preserves the edited farmer through selection",
	{ timeout: 25000 },
	async () => {
		const opened = await openRecipes();
		const { page, model } = opened;
		try {
			const count = page.getByRole("spinbutton", { name: "Fried Egg cooked" });
			expect((count as HTMLInputElement).value).toBe("5");
			await fireEvent.focus(count);
			await fireEvent.input(count, { target: { value: "6" } });
			await fireEvent.input(count, { target: { value: "66" } });
			await fireEvent.change(page.getByRole("combobox", { name: "Farmer" }), {
				target: { value: "guest" },
			});
			const snapshot = await model.snapshot();
			await waitFor(() =>
				expect(
					(
						page.getByRole("spinbutton", {
							name: "Fried Egg cooked",
						}) as HTMLInputElement
					).value,
				).toBe("17"),
			);
			expect(snapshot.entries).toHaveLength(1);
			expect(
				readRecipes(snapshot.document)
					.find((owner) => owner.farmerId === opened.hostId)
					?.cooking.find((row) => row.name === "Fried Egg")?.count,
			).toBe(66);
			await model.commands.undo();
			const after = readRecipes((await model.snapshot()).document);
			expect(
				after
					.find((owner) => owner.farmerId === opened.hostId)
					?.cooking.find((row) => row.name === "Fried Egg")?.count,
			).toBe(5);
			expect(
				after
					.find((owner) => owner.farmerId === "guest")
					?.cooking.find((row) => row.name === "Fried Egg")?.count,
			).toBe(17);
		} finally {
			await opened.dispose();
		}
	},
);

// Cooking history is independent of knowledge; crafting stores the count with
// knowledge, so its explicit removal explains and confirms the coordinated loss.
it(
	"forgets cooking without losing cooked progress and confirms crafting removal",
	{ timeout: 25000 },
	async () => {
		const opened = await openRecipes();
		const { page, model } = opened;
		try {
			await fireEvent.click(
				page.getByRole("button", { name: /^Forget Fried Egg$/ }),
			);
			await model.snapshot();
			await waitFor(() =>
				expect(
					page.getByRole("button", { name: /^Learn Fried Egg$/ }),
				).toBeTruthy(),
			);
			expect(
				(
					page.getByRole("spinbutton", {
						name: "Fried Egg cooked",
					}) as HTMLInputElement
				).value,
			).toBe("5");
			// Zero does not clear the game's recorded-cooking flag. The explicit
			// reset must remain available and remove that zero-valued entry.
			const cooked = page.getByRole("spinbutton", { name: "Fried Egg cooked" });
			await fireEvent.focus(cooked);
			await fireEvent.input(cooked, { target: { value: "0" } });
			await fireEvent.blur(cooked);
			await model.edits.endActive();
			await model.snapshot();
			expect(page.getByText("Recorded as cooked")).toBeTruthy();
			expect(
				(
					page.getByRole("button", {
						name: /^Reset Fried Egg count$/,
					}) as HTMLButtonElement
				).disabled,
			).toBe(false);
			const resetDialog = page
				.getByRole("heading", {
					name: "Reset Fried Egg cooking progress?",
					hidden: true,
				})
				.closest("dialog");
			if (!resetDialog) throw new Error("Missing cooking reset confirmation");
			resetDialog.showModal = () => {
				resetDialog.open = true;
			};
			resetDialog.close = () => {
				resetDialog.open = false;
			};
			await fireEvent.click(
				page.getByRole("button", { name: /^Reset Fried Egg count$/ }),
			);
			const resetForm = resetDialog.querySelector("form");
			if (!resetForm) throw new Error("Missing cooking reset form");
			await fireEvent.submit(resetForm);
			await model.snapshot();
			await waitFor(() =>
				expect(
					(
						page.getByRole("spinbutton", {
							name: "Fried Egg cooked",
						}) as HTMLInputElement
					).value,
				).toBe("0"),
			);
			expect(
				readRecipes((await model.snapshot()).document)
					.find((owner) => owner.farmerId === opened.hostId)
					?.cooking.find((row) => row.name === "Fried Egg")?.hasCookedEntry,
			).toBe(false);
			await model.commands.undo();
			expect(
				readRecipes((await model.snapshot()).document)
					.find((owner) => owner.farmerId === opened.hostId)
					?.cooking.find((row) => row.name === "Fried Egg"),
			).toMatchObject({ count: 0, hasCookedEntry: true });
			await model.commands.undo();
			await fireEvent.click(page.getByRole("button", { name: /^Crafting$/ }));
			const before = await model.snapshot();
			const dialog = page
				.getByRole("heading", { name: "Forget Torch?", hidden: true })
				.closest("dialog");
			if (!dialog) throw new Error("Missing crafting confirmation");
			dialog.showModal = () => {
				dialog.open = true;
			};
			dialog.close = () => {
				dialog.open = false;
			};
			await fireEvent.click(
				page.getByRole("button", { name: /^Forget Torch$/ }),
			);
			expect(dialog.open).toBe(true);
			expect((await model.snapshot()).document).toEqual(before.document);
			const form = dialog.querySelector("form");
			if (!form) throw new Error("Missing confirmation form");
			await fireEvent.submit(form);
			await model.snapshot();
			await waitFor(() =>
				expect(
					page.getByRole("button", { name: /^Learn Torch$/ }),
				).toBeTruthy(),
			);
			expect(
				(
					page.getByRole("spinbutton", {
						name: "Torch crafted items",
					}) as HTMLInputElement
				).disabled,
			).toBe(true);
			await model.commands.undo();
			expect((await model.snapshot()).document).toEqual(before.document);
			await fireEvent.click(page.getByRole("button", { name: /^Cooking$/ }));
			expect(
				(
					page.getByRole("spinbutton", {
						name: "Fried Egg cooked",
					}) as HTMLInputElement
				).value,
			).toBe("5");
		} finally {
			await opened.dispose();
		}
	},
);
