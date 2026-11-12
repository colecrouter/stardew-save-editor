import { expect, it, vi } from "vitest";
import { fireEvent, render, within, waitFor } from "@testing-library/svelte";
import { openTestEditor } from "../helpers/open-editor.ts";
import WorkspaceHarness from "./WorkspaceHarness.svelte";
import { fixtureXml } from "./fixtures";

it(
	"builds review only while visible, shows final values and removes restored edits from export review",
	{ timeout: 30000 },
	async () => {
		const opened = await openTestEditor(new TextEncoder().encode(fixtureXml));
		const review = vi.spyOn(opened.model.commands, "review");
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			const initial = await opened.model.snapshot();
			await opened.model.commands.execute([
				{ type: "farm-name", value: "Juniper" },
			]);
			expect(review).not.toHaveBeenCalled();
			const beforeReview = await opened.model.snapshot();
			await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
			const group = () => page.getByRole("region", { name: "Farm settings" });
			await page.findByRole(
				"region",
				{ name: "Farm settings" },
				{ timeout: 10000 },
			);
			expect(
				within(group()).getByRole("columnheader", { name: "Before" }),
			).toBeTruthy();
			expect(
				within(group()).getByRole("columnheader", { name: "After" }),
			).toBeTruthy();
			expect(
				within(group()).getByRole("cell", { name: "Juniper" }),
			).toBeTruthy();
			expect((await opened.model.snapshot()).entries).toEqual(
				beforeReview.entries,
			);
			expect((await opened.model.snapshot()).revision).toBe(
				beforeReview.revision,
			);
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			const calls = review.mock.calls.length;
			await opened.model.commands.execute([
				{ type: "farm-name", value: "Orchard" },
			]);
			expect(review).toHaveBeenCalledTimes(calls);
			await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
			await waitFor(() =>
				expect(
					within(group()).getByRole("cell", { name: "Orchard" }),
				).toBeTruthy(),
			);
			expect(
				within(group()).queryByRole("cell", { name: "Juniper" }),
			).toBeNull();
			// Restore the imported value through a real edit rather than Undo: history
			// remains nonempty while the export comparison must become empty.
			await opened.model.commands.execute([
				{ type: "farm-name", value: initial.document.SaveGame.player.farmName },
			]);
			await page.findByText("No exported changes from the imported save.");
			expect((await opened.model.snapshot()).entries.length).toBeGreaterThan(0);
			expect(
				page.getByText("Edit history", { selector: "summary" }),
			).toBeTruthy();
		} finally {
			page.unmount();
			review.mockRestore();
			await opened.close();
		}
	},
);

it(
	"keeps unclassified saved data visible instead of reporting an empty export",
	{ timeout: 25000 },
	async () => {
		const { Effect } = await import("effect");
		const { TransactionDraft } =
			await import("../../src/lib/editor/transaction-draft");
		const opened = await openTestEditor(new TextEncoder().encode(fixtureXml));
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			await opened.model.commands.transact(
				Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					yield* draft.mutate((state) => {
						Object.assign(state.document.SaveGame, { moddedCounter: 1 });
					});
				}),
			);
			await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
			const other = await page.findByRole(
				"region",
				{ name: "Other save changes" },
				{ timeout: 10000 },
			);
			expect(
				within(other).getByText("/SaveGame/moddedCounter", {
					selector: "code",
				}),
			).toBeTruthy();
			expect(page.queryByText("No changes to export")).toBeNull();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it(
	"ignores a late comparison after a newer committed revision is displayed",
	{ timeout: 25000 },
	async () => {
		const opened = await openTestEditor(new TextEncoder().encode(fixtureXml));
		await opened.model.commands.execute([
			{ type: "farm-name", value: "Juniper" },
		]);
		const earlier = await opened.model.commands.review();
		let release: (() => void) | undefined;
		const read = vi
			.spyOn(opened.model.commands, "review")
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = () => resolve(earlier);
					}),
			);
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
			await waitFor(() => expect(read).toHaveBeenCalledOnce());
			await opened.model.commands.execute([
				{ type: "farm-name", value: "Orchard" },
			]);
			await page.findByRole("cell", { name: "Orchard" }, { timeout: 10000 });
			release?.();
			await Promise.resolve();
			expect(page.getByRole("cell", { name: "Orchard" })).toBeTruthy();
			expect(page.queryByRole("cell", { name: "Juniper" })).toBeNull();
		} finally {
			release?.();
			page.unmount();
			read.mockRestore();
			await opened.close();
		}
	},
);
