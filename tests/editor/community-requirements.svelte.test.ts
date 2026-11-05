import { expect, it } from "vitest";
import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { openEditor } from "../../src/lib/editor/editor-model";
import { readCommunity } from "../../src/lib/editor/community-data";
import CharacterHarness from "./CharacterHarness.svelte";
import { fixtureXml } from "./fixtures";

it(
	"keeps requirement drafts cancellable and commits one undoable transaction",
	{ timeout: 30000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			await page.findByRole(
				"button",
				{ name: /Crafts Room Donations/ },
				{ timeout: 10000 },
			);
			await fireEvent.click(
				page.getByRole("button", { name: /Crafts Room Donations/ }),
			);
			const card = page.getByRole("article", {
				name: "Spring Foraging bundle",
			});
			const before = await opened.model.snapshot();
			await fireEvent.click(
				within(card).getByRole("button", { name: "Edit requirements" }),
			);
			let dialog = page.getByRole("dialog");
			await fireEvent.input(
				within(dialog).getByRole("spinbutton", {
					name: "Quantity for requirement 1",
				}),
				{ target: { value: "7" } },
			);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Cancel" }),
			);
			await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
			expect((await opened.model.snapshot()).entries).toEqual(before.entries);
			await fireEvent.click(
				within(card).getByRole("button", { name: "Edit requirements" }),
			);
			dialog = page.getByRole("dialog");
			await fireEvent.input(
				within(dialog).getByRole("spinbutton", {
					name: "Quantity for requirement 1",
				}),
				{ target: { value: "7" } },
			);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Apply requirements" }),
			);
			await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
			const after = await opened.model.snapshot();
			expect(
				readCommunity(after.document).bundles.find((row) => row.id === 13)
					?.requirements[0]?.quantity,
			).toBe(7);
			expect(after.entries.length).toBe(before.entries.length + 1);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await opened.model.commands.redo();
			expect((await opened.model.snapshot()).document).toEqual(after.document);
			await fireEvent.click(
				page.getByRole("button", { name: "Complete room" }),
			);
			await waitFor(async () =>
				expect(
					readCommunity((await opened.model.snapshot()).document).rooms.find(
						(row) => row.id === 1,
					)?.completed,
				).toBe(true),
			);
			const completedRoom = await opened.model.snapshot();
			expect(completedRoom.entries.length).toBe(after.entries.length + 1);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(after.document);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
