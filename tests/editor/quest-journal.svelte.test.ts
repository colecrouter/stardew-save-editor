import { fireEvent, waitFor, within } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { renderTestWorkspace } from "./workspace.ts";
import { readQuestJournals } from "../../src/lib/editor/quest-operations.ts";
import { parser, fixtureXml } from "./fixtures.ts";
const quest = (extra: Record<string, unknown> = {}) => ({
	_questTitle: "Delivery",
	_questDescription: "A journal quest",
	_currentObjective: "Bring the requested item",
	id: "custom",
	completed: false,
	dailyQuest: false,
	destroy: false,
	canBeCancelled: true,
	moneyReward: 100,
	daysLeft: 0,
	questType: 1,
	nextQuests: [],
	...extra,
});
async function open(quests = [quest()], extra: Record<string, unknown> = {}) {
	const document = parser.parse(fixtureXml);
	const host = document.SaveGame.player;
	Object.assign(host, { questLog: quests, ...extra });
	const guest = structuredClone(host);
	guest.UniqueMultiplayerID = 2n;
	guest.name = "Guest";
	Object.assign(guest, { questLog: [quest({ moneyReward: 700 })] });
	document.SaveGame.farmhands = [guest];
	const opened = await renderTestWorkspace(document, "Quest journal");
	return { ...opened, hostId: String(host.UniqueMultiplayerID) };
}
// Continuous values publish immediately, but one gesture belongs to its captured
// quest/farmer even when the next selection is submitted before it completes.
it(
	"groups journal reward typing and never retargets queued edits to another farmer",
	{ timeout: 25000 },
	async () => {
		const opened = await open();
		const { page, model } = opened;
		try {
			const reward = page.getByRole("spinbutton", {
				name: "Delivery gold reward",
			});
			await fireEvent.focus(reward);
			await fireEvent.input(reward, { target: { value: "200" } });
			await fireEvent.input(reward, { target: { value: "500" } });
			await fireEvent.change(page.getByRole("combobox", { name: "Farmer" }), {
				target: { value: "2" },
			});
			const snapshot = await model.snapshot();
			expect(snapshot.entries).toHaveLength(1);
			expect(
				readQuestJournals(snapshot.document).find(
					(owner) => owner.farmerId === opened.hostId,
				)?.quests[0]?.reward,
			).toBe(500);
			await waitFor(() =>
				expect(
					(
						page.getByRole("spinbutton", {
							name: "Delivery gold reward",
						}) as HTMLInputElement
					).value,
				).toBe("700"),
			);
			await model.commands.undo();
			await fireEvent.change(page.getByRole("combobox", { name: "Farmer" }), {
				target: { value: opened.hostId },
			});
			await model.snapshot();
			await waitFor(() =>
				expect(
					(
						page.getByRole("spinbutton", {
							name: "Delivery gold reward",
						}) as HTMLInputElement
					).value,
				).toBe("100"),
			);
		} finally {
			await opened.dispose();
		}
	},
);
// Completion is deliberate and atomic: even when the backpack cannot receive a
// ticket, the receipt explains what happened and Undo restores the whole journal.
it(
	"confirms completion, reports a lost Prize Ticket and restores all consequences with Undo",
	{ timeout: 25000 },
	async () => {
		const opened = await open([quest({ dailyQuest: true })], {
			stats: {
				Values: [
					{
						key: "BillboardQuestsDone",
						value: 2,
					},
				],
			},
			items: Array.from({ length: 12 }, () => ({
				"@_xsi:nil": "true",
				opaque: "keep",
			})),
			mailReceived: [],
			activeDialogueEvents: [],
			previousActiveDialogueEvents: [],
		});
		const { page, model } = opened;
		try {
			const before = await model.snapshot();
			const dialog = page
				.getByRole("heading", { name: "Complete Delivery?", hidden: true })
				.closest("dialog");
			if (!dialog) throw new Error("Missing confirmation");
			dialog.showModal = () => {
				dialog.open = true;
			};
			dialog.close = () => {
				dialog.open = false;
			};
			await fireEvent.click(
				page.getByRole("button", { name: /^Complete Delivery$/ }),
			);
			expect(dialog.open).toBe(true);
			expect((await model.snapshot()).entries).toHaveLength(0);
			const form = dialog.querySelector("form");
			if (!form) throw new Error("Missing form");
			await fireEvent.submit(form);
			await model.snapshot();
			await waitFor(
				() =>
					expect(
						page.getByText(/No safe backpack slot was available/),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			const after = await model.snapshot();
			expect(after.entries).toHaveLength(1);
			expect(
				readQuestJournals(after.document).find(
					(owner) => owner.farmerId === opened.hostId,
				)?.quests[0]?.completed,
			).toBe(true);
			expect(after.document.SaveGame.player.items).toEqual(
				before.document.SaveGame.player.items,
			);
			await model.commands.undo();
			expect((await model.snapshot()).document).toEqual(before.document);
		} finally {
			await opened.dispose();
		}
	},
);
// Imported duplicates must be visible without Svelte key collisions. They do not
// acquire distinct command authority merely because two cards were rendered.
it(
	"renders duplicate quest identities read-only without crashing",
	{ timeout: 25000 },
	async () => {
		const opened = await open([quest(), quest()]);
		try {
			const notices = within(
				opened.page.getByRole("navigation", { name: "Quest notices" }),
			).getAllByRole("button", { name: /^Delivery/ });
			expect(notices).toHaveLength(2);
			for (const notice of notices) {
				await fireEvent.click(notice);
				expect(
					opened.page.getByRole("region", { name: "Delivery quest" }),
				).toBeTruthy();
				for (const button of opened.page.getAllByRole("button", {
					name: /^(Complete|Remove) Delivery$/,
				}))
					expect(button.hasAttribute("disabled")).toBe(true);
			}
		} finally {
			await opened.dispose();
		}
	},
);

it(
	"browses notices without history and closes a reward gesture before selecting another quest",
	{ timeout: 25000 },
	async () => {
		const opened = await open([
			quest(),
			quest({ id: "second", _questTitle: "Another request", moneyReward: 400 }),
		]);
		const { page, model } = opened;
		try {
			const before = await model.snapshot();
			const notices = within(
				page.getByRole("navigation", { name: "Quest notices" }),
			);
			await fireEvent.click(
				notices.getByRole("button", { name: /^Another request/ }),
			);
			expect(
				page.getByRole("spinbutton", { name: "Another request gold reward" }),
			).toHaveProperty("value", "400");
			expect((await model.snapshot()).document).toEqual(before.document);
			expect((await model.snapshot()).entries).toEqual(before.entries);
			await fireEvent.click(notices.getByRole("button", { name: /^Delivery/ }));
			const reward = page.getByRole("spinbutton", {
				name: "Delivery gold reward",
			});
			await fireEvent.focus(reward);
			await fireEvent.input(reward, { target: { value: "250" } });
			await fireEvent.click(
				notices.getByRole("button", { name: /^Another request/ }),
			);
			const after = await model.snapshot();
			expect(after.entries).toHaveLength(1);
			const quests = readQuestJournals(after.document).find(
				(owner) => owner.farmerId === opened.hostId,
			)?.quests;
			expect(quests?.find((row) => row.title === "Delivery")?.reward).toBe(250);
			expect(
				quests?.find((row) => row.title === "Another request")?.reward,
			).toBe(400);
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search quests" }),
				{ target: { value: "no matching quest" } },
			);
			expect(page.getByText("No quests match your search.")).toBeTruthy();
			expect(page.queryByRole("group", { name: "Selected notice" })).toBeNull();
			expect((await model.snapshot()).entries).toHaveLength(1);
			await model.commands.undo();
			expect((await model.snapshot()).document).toEqual(before.document);
		} finally {
			await opened.dispose();
		}
	},
);
