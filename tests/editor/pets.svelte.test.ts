import { fireEvent, waitFor, within } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { readPets } from "../../src/lib/editor/pet-data.ts";
import { renderTestWorkspace } from "./workspace.ts";
import { fixtureXml, parser, exportDocument } from "./fixtures.ts";
import { catId, dogId, withPets, fixturePet } from "./pet-fixtures.ts";
import { petAppearanceKey } from "../../src/lib/editor/pet-appearance.ts";

it(
	"groups pet name typing, keeps same-name pets distinct, and round-trips friendship",
	{ timeout: 25000 },
	async () => {
		const opened = await renderTestWorkspace(
			withPets(parser.parse(fixtureXml)),
			"Pets",
		);
		const { page, model } = opened;
		try {
			const original = await model.snapshot();
			const name = page.getAllByRole("textbox", {
				name: "Name",
				hidden: false,
			})[0] as HTMLInputElement;
			name.focus();
			await fireEvent.input(name, { target: { value: "Mo" } });
			await fireEvent.input(name, { target: { value: "Mochi" } });
			await fireEvent.blur(name);
			const renamed = await model.snapshot();
			expect(renamed.entries).toHaveLength(1);
			expect(readPets(renamed.document)).toMatchObject([
				{ id: catId, name: "Mochi" },
				{ id: dogId, name: "Miso" },
			]);
			await model.commands.undo();
			await waitFor(() => expect(name.value).toBe("Miso"));
			expect((await model.snapshot()).document).toEqual(original.document);
			await model.commands.redo();
			await waitFor(() => expect(name.value).toBe("Mochi"));

			const dog = within(page.getByRole("region", { name: "Miso" }));
			const friendship = dog.getByRole("spinbutton", {
				name: "Friendship",
			}) as HTMLInputElement;
			friendship.focus();
			await fireEvent.input(friendship, { target: { value: "1000" } });
			await fireEvent.blur(friendship);
			const edited = await model.snapshot();
			expect(
				readPets(parser.parse(exportDocument(edited.document))),
			).toMatchObject([
				{ id: catId, friendship: 400 },
				{ id: dogId, friendship: 1000 },
			]);
			expect(edited.entries).toHaveLength(2);
			// Invalid input must surface accessible feedback without publishing data.
			friendship.focus();
			await fireEvent.input(friendship, { target: { value: "1001" } });
			await waitFor(() =>
				expect(friendship.getAttribute("aria-invalid")).toBe("true"),
			);
			expect(friendship.getAttribute("aria-describedby")).toBeTruthy();
			await fireEvent.blur(friendship);
			expect((await model.snapshot()).document).toEqual(edited.document);
			await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
			await waitFor(() =>
				expect(page.getByRole("heading", { name: "Pets" })).toBeTruthy(),
			);
		} finally {
			await opened.dispose();
		}
	},
);

it(
	"shows unsupported pet fields as read-only and explains why",
	{ timeout: 15000 },
	async () => {
		const document = withPets(parser.parse(fixtureXml));
		const pet = fixturePet(document);
		pet["$type"] = "CustomPet";
		const opened = await renderTestWorkspace(document, "Pets");
		try {
			const before = await opened.model.snapshot();
			const names = opened.page.getAllByRole("textbox", { name: "Name" });
			expect((names[0] as HTMLInputElement).disabled).toBe(true);
			expect((names[1] as HTMLInputElement).disabled).toBe(false);
			expect(
				(
					opened.page.getAllByRole("combobox", {
						name: "Appearance",
					})[0] as HTMLSelectElement
				).disabled,
			).toBe(true);
			expect(
				opened.page.getAllByText("This custom pet class is read-only.").length,
			).toBeGreaterThan(0);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			await opened.dispose();
		}
	},
);

it(
	"changes appearance for two same-name pets independently and restores a custom breed on Undo",
	{ timeout: 25000 },
	async () => {
		const opened = await renderTestWorkspace(
			withPets(parser.parse(fixtureXml)),
			"Pets",
		);
		const { page, model } = opened;
		try {
			const original = await model.snapshot();
			const [cat, dog] = page.getAllByRole("combobox", {
				name: "Appearance",
			}) as HTMLSelectElement[];
			if (!cat || !dog) throw new Error("Missing appearance selectors");
			expect(cat.value).toBe(petAppearanceKey("Cat", "0"));
			expect(dog.value).toBe(petAppearanceKey("Dog", "custom-breed"));
			expect(
				within(dog).getByRole("option", {
					name: "Custom (Dog — breed custom-breed)",
				}),
			).toBeTruthy();
			await fireEvent.change(dog, {
				target: { value: petAppearanceKey("Turtle", "1") },
			});
			await fireEvent.change(cat, {
				target: { value: petAppearanceKey("Dog", "4") },
			});
			const after = await model.snapshot();
			expect(after.entries).toHaveLength(2);
			expect(readPets(after.document)).toMatchObject([
				{ id: catId, type: "Dog", breed: "4" },
				{ id: dogId, type: "Turtle", breed: "1" },
			]);
			await waitFor(() =>
				expect(
					page.getByRole("img", {
						name: "Vanilla appearance: Turtle — breed 1",
					}),
				).toBeTruthy(),
			);
			await model.commands.undo();
			await model.commands.undo();
			await waitFor(() =>
				expect(dog.value).toBe(petAppearanceKey("Dog", "custom-breed")),
			);
			expect((await model.snapshot()).document).toEqual(original.document);
			expect(
				page.queryByRole("img", {
					name: "Vanilla appearance: Turtle — breed 1",
				}),
			).toBeNull();
		} finally {
			await opened.dispose();
		}
	},
);

it(
	"shows an unreadable appearance without implying the first vanilla choice is selected",
	{ timeout: 15000 },
	async () => {
		const document = withPets(parser.parse(fixtureXml));
		fixturePet(document).whichBreed = { future: "opaque" };
		const opened = await renderTestWorkspace(document, "Pets");
		try {
			const selector = opened.page.getAllByRole("combobox", {
				name: "Appearance",
			})[0] as HTMLSelectElement;
			expect(selector.disabled).toBe(true);
			expect(selector.selectedOptions[0]?.textContent).toBe(
				"Unreadable saved appearance",
			);
			expect(
				(
					opened.page.getAllByRole("textbox", {
						name: "Name",
					})[0] as HTMLInputElement
				).disabled,
			).toBe(false);
		} finally {
			await opened.dispose();
		}
	},
);
