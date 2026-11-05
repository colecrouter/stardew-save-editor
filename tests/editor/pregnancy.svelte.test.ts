import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { readPregnancy } from "../../src/lib/editor/pregnancy-data.ts";
import WorkspaceHarness from "./WorkspaceHarness.svelte";
import { parser, fixtureXml, exportDocument } from "./fixtures.ts";

// Exercise the real field controllers and transaction queue, not a callback mock.
// The selected couple owns both the discrete toggle and grouped due-date typing.
it(
	"edits a spouse pregnancy with exact Undo/Redo and leaves other farmers unchanged",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		const host = document.SaveGame.player;
		Object.assign(host, {
			friendshipData: {
				item: [
					{
						key: { string: "Abigail" },
						value: {
							Friendship: {
								Status: "Married",
								Points: 2500,
								RoommateMarriage: false,
								WeddingDate: { Year: 1, Season: "spring", DayOfMonth: 1 },
							},
						},
					},
				],
			},
		});
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			await fireEvent.click(page.getByRole("link", { name: "Relationships" }));
			// Family planning adds only a compact spouse-row summary until requested.
			const summary = page.getByText("Family planning", { exact: true });
			const disclosure = summary.closest("details");
			if (!disclosure) throw new Error("Missing family-planning disclosure");
			expect(disclosure.open).toBe(false);
			// HappyDOM does not hide closed details from role queries. Browser QA
			// checks visibility; this test opens the native disclosure for field edits.
			disclosure.open = true;
			const expecting = page.getByRole("checkbox", {
				name: "Expecting a baby",
			});
			const reservedDays = page.getByRole("spinbutton", {
				name: "Days until birth",
			});
			expect(reservedDays.hasAttribute("disabled")).toBe(true);
			await fireEvent.click(expecting);
			// The queue barrier checks committed behavior rather than requiring a
			// full-save projection to finish within Testing Library's default second.
			await opened.model.snapshot();
			await waitFor(() =>
				expect(
					page.getByRole("spinbutton", { name: "Days until birth" }),
				).toHaveProperty("value", "14"),
			);
			const days = page.getByRole("spinbutton", { name: "Days until birth" });
			expect(days).toBe(reservedDays);
			expect(days.hasAttribute("disabled")).toBe(false);
			await fireEvent.input(days, { target: { value: "12" } });
			await fireEvent.input(days, { target: { value: "10" } });
			await fireEvent.blur(days);

			const committed = await opened.model.snapshot();
			expect(
				readPregnancy(committed.document, String(host.UniqueMultiplayerID))
					.daysUntilBirth,
			).toBe(10);
			expect(committed.entries).toHaveLength(2);
			expect(committed.document.SaveGame.farmhands).toEqual(
				document.SaveGame.farmhands,
			);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page.getByRole("spinbutton", { name: "Days until birth" }),
				).toHaveProperty("value", "14"),
			);
			await opened.model.commands.redo();
			await waitFor(() =>
				expect(
					page.getByRole("spinbutton", { name: "Days until birth" }),
				).toHaveProperty("value", "10"),
			);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
