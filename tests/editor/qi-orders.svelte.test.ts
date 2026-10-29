import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { readQiOrders } from "../../src/lib/editor/qi-order-operations.ts";
import CharacterHarness from "./CharacterHarness.svelte";
import { parser, fixtureXml, exportDocument } from "./fixtures.ts";

// The real workspace exercises discrete offer fields, coordinated dialogs and
// global Undo through one file queue; no domain transaction is stubbed out.
it(
	"enforces the shared board cap and confirms atomic activation/cancellation with Undo",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame, {
			availableSpecialOrders: "",
			specialOrders: "",
		});
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(page.getByRole("link", { name: "Qi orders" }));
			await fireEvent.click(
				page.getByRole("checkbox", { name: "Offer Let's Play A Game" }),
			);
			await fireEvent.click(
				page.getByRole("checkbox", { name: "Offer Four Precious Stones" }),
			);
			await opened.model.snapshot();
			await waitFor(() =>
				expect(
					(
						page.getByRole("checkbox", {
							name: "Offer Qi's Hungry Challenge",
						}) as HTMLInputElement
					).disabled,
				).toBe(true),
			);
			const confirm = async (title: string, button: string) => {
				const dialog = page
					.getByRole("heading", { name: title, hidden: true })
					.closest("dialog");
				if (!dialog) throw new Error("Missing Qi action dialog");
				// happy-dom does not implement browser modal presentation; retain the actual
				// dialog/form handlers while supplying native open/close attribute behavior.
				dialog.showModal = () => {
					dialog.open = true;
				};
				dialog.close = () => {
					dialog.open = false;
				};
				await fireEvent.click(page.getByRole("button", { name: button }));
				expect(dialog.open).toBe(true);
				const form = dialog.querySelector("form");
				if (!form) throw new Error("Missing Qi action form");
				await fireEvent.submit(form);
				await opened.model.snapshot();
				// Successful state transitions replace this action component. The old
				// dialog can be detached before its native close method is reached.
				await waitFor(() =>
					expect(!dialog.isConnected || !dialog.open).toBe(true),
				);
			};
			await confirm(
				"Start Qi's Hungry Challenge?",
				"Make Qi's Hungry Challenge active",
			);
			const accepted = await opened.model.snapshot();
			const view = readQiOrders(accepted.document);
			expect(view.rows.find((row) => row.key === "QiChallenge3")?.offered).toBe(
				false,
			);
			expect(view.rows.find((row) => row.key === "QiChallenge4")?.offered).toBe(
				true,
			);
			expect(view.rows.find((row) => row.key === "QiChallenge5")?.state).toBe(
				"InProgress",
			);
			expect(accepted.entries).toHaveLength(3);
			await confirm(
				"Cancel Qi's Hungry Challenge?",
				"Cancel Qi's Hungry Challenge",
			);
			expect(
				readQiOrders((await opened.model.snapshot()).document).rows.find(
					(row) => row.key === "QiChallenge5",
				)?.state,
			).toBeUndefined();
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(
				accepted.document,
			);
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			await fireEvent.click(page.getByRole("link", { name: "Qi orders" }));
			expect(
				page.getByRole("button", { name: "Cancel Qi's Hungry Challenge" }),
			).toBeTruthy();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it(
	"keeps completed and unknown active orders visible and read-only",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame, {
			availableSpecialOrders: "",
			specialOrders: {
				SpecialOrder: [
					{
						questKey: "QiChallenge3",
						orderType: "Qi",
						questState: "Complete",
						unclaimedRewardsIDs: { long: [44] },
						opaque: "keep",
					},
					{
						questKey: "Mod.Unknown",
						orderType: "Qi",
						questState: "InProgress",
						opaque: "preserve",
					},
				],
			},
		});
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const before = await opened.model.snapshot();
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(page.getByRole("link", { name: "Qi orders" }));
			expect(
				(
					page.getByRole("checkbox", {
						name: "Offer Let's Play A Game",
					}) as HTMLInputElement
				).disabled,
			).toBe(true);
			expect(page.getByText("Complete", { exact: true })).toBeTruthy();
			expect(
				page.queryByRole("button", { name: "Cancel Let's Play A Game" }),
			).toBeNull();
			expect(
				(
					page.getByRole("checkbox", {
						name: "Offer Mod.Unknown",
					}) as HTMLInputElement
				).disabled,
			).toBe(true);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
