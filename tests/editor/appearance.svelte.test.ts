import { readAppearances } from "../../src/lib/editor/appearance-operations.ts";
import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import CharacterHarness from "./CharacterHarness.svelte";
import { parser, fixtureXml, exportDocument } from "./fixtures.ts";

it(
	"groups appearance input and preserves the captured farmer when selection changes",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml),
			host = document.SaveGame.player;
		Object.assign(host, {
			favoriteThing: "Host favorite",
			hairstyleColor: { R: 10, G: 20, B: 30, A: 255 },
		});
		const guest = structuredClone(host);
		guest.UniqueMultiplayerID = "guest";
		guest.name = "Guest";
		Object.assign(guest, { favoriteThing: "Guest favorite" });
		document.SaveGame.farmhands = { Farmer: [guest] };
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(CharacterHarness, { model: opened.model });
		try {
			// Unvisited editors must not mount their controls or subscriptions.
			expect(
				page.queryByLabelText("Favorite thing", { selector: "input" }),
			).toBeNull();
			expect(
				page.queryByLabelText("Farming XP", { selector: "input" }),
			).toBeNull();
			expect(page.queryByLabelText("Search villagers")).toBeNull();
			await fireEvent.click(page.getByRole("link", { name: "Appearance" }));
			const firstFavorite = page.getByRole("textbox", {
				name: "Favorite thing",
			});
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			await fireEvent.click(page.getByRole("link", { name: "Appearance" }));
			expect(page.getByRole("textbox", { name: "Favorite thing" })).toBe(
				firstFavorite,
			);
			const name = page.getByRole("textbox", { name: "Name" });
			await fireEvent.focus(name);
			await fireEvent.input(name, { target: { value: "A" } });
			await fireEvent.input(name, { target: { value: "Alex" } });
			await fireEvent.blur(name);
			await waitFor(() =>
				expect((name as HTMLInputElement).value).toBe("Alex"),
			);
			// A queued history read waits for every submitted keystroke before inspecting.
			await opened.model.edits.endActive();
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect((name as HTMLInputElement).value).toBe(host.name),
			);
			const color = page.getByLabelText("Hair color");
			await fireEvent.focus(color);
			await fireEvent.input(color, { target: { value: "#112233" } });
			await fireEvent.input(color, { target: { value: "#445566" } });
			await fireEvent.blur(color);
			await opened.model.edits.endActive();
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect((color as HTMLInputElement).value).toBe("#0a141e"),
			);
			const favorite = page.getByRole("textbox", {
				name: "Favorite thing",
			});
			await fireEvent.focus(favorite);
			await fireEvent.input(favorite, { target: { value: "Moon" } });
			const selectors = page.getAllByRole("combobox", {
				name: "Farmer",
			});
			const visible = selectors.find((element) => !element.closest("[hidden]"));
			if (!visible) throw new Error("Missing visible farmer selector");
			await fireEvent.change(visible, { target: { value: "guest" } });
			// Drain only after submitting both edits and selection, retaining the race
			// while separating command completion from DOM publication assertions.
			await opened.model.snapshot();
			await waitFor(
				() =>
					expect(
						(
							page.getByRole("textbox", {
								name: "Favorite thing",
							}) as HTMLInputElement
						).value,
					).toBe("Guest favorite"),
				{ timeout: 5000 },
			);
			const snapshot = await opened.model.snapshot();
			expect(snapshot.document.SaveGame.player).toMatchObject({
				favoriteThing: "Moon",
			});
			expect(
				readAppearances(snapshot.document).find(
					(view) => view.farmerId === "guest",
				)?.texts.favorite.value,
			).toBe("Guest favorite");
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
