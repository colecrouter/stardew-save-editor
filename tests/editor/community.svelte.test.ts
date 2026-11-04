import { expect, it } from "vitest";
import { render, fireEvent, within, waitFor } from "@testing-library/svelte";
import { openEditor } from "../../src/lib/editor/editor-model";
import CharacterHarness from "./CharacterHarness.svelte";
import { fixtureXml } from "./fixtures";
import { readCommunity } from "../../src/lib/editor/community-data";

it(
	"edits donations, changes membership and projects with complete Undo and preserved room selection",
	{ timeout: 30000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			const card = await page.findByRole(
				"article",
				{
					name: "Spring Foraging bundle",
				},
				{ timeout: 10000 },
			);
			const checkbox = within(card).getAllByRole(
				"checkbox",
			)[0] as HTMLInputElement;
			const original = checkbox.checked;
			await fireEvent.click(checkbox);
			await waitFor(async () =>
				expect(
					readCommunity((await opened.model.snapshot()).document).bundles.find(
						(row) => row.id === 13,
					)?.requirements[0]?.submitted,
				).toBe(!original),
			);
			await opened.model.commands.undo();
			await waitFor(() => expect(checkbox.checked).toBe(original));
			await fireEvent.click(page.getByRole("button", { name: "Change route" }));
			// Membership is a coordinated action: opening the confirmation changes no save flags.
			expect(
				readCommunity((await opened.model.snapshot()).document).membership,
			).toBe(false);
			const dialog = page.getByRole("dialog");
			await fireEvent.click(
				within(dialog).getByRole("radio", { name: "Joja membership" }),
			);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Switch to Joja" }),
			);
			// Publishing membership and releasing the modal are asynchronous. Wait for
			// the route-change dialog to close before querying the newly exposed board;
			// a busy CI worker must not mistake the still-modal page for missing controls.
			await waitFor(() => expect(page.queryByRole("dialog")).toBeNull(), {
				timeout: 10000,
			});
			const bridge = await page.findByRole(
				"checkbox",
				{ name: "Bridge project complete" },
				{ timeout: 10000 },
			);
			await fireEvent.click(bridge);
			await waitFor(async () => {
				expect(
					readCommunity((await opened.model.snapshot()).document).rooms.find(
						(room) => room.id === 1,
					)?.restored,
				).toBe(true);
				expect(bridge).toHaveProperty("checked", true);
			});
			await opened.model.commands.undo();
			expect(
				readCommunity((await opened.model.snapshot()).document).theater,
			).toBe(false);
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			expect(
				page.getByRole("region", { name: "Joja development plan" }),
			).toBeTruthy();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
