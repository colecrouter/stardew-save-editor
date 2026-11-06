import { expect, it, vi } from "vitest";
import { Result } from "effect";
import { render, fireEvent, within, waitFor } from "@testing-library/svelte";
import { openEditor } from "../../src/lib/editor/editor-model";
import { readCommunity } from "../../src/lib/editor/community-data";
import { setCommunityProgress } from "../../src/lib/editor/community-operations";
import { MutationError } from "../../src/lib/editor/mutation-error";
import WorkspaceHarness from "./WorkspaceHarness.svelte";
import { fixtureXml, parser, exportDocument } from "./fixtures";

it(
	"shows only the saved route and preserves donations, rewards and room across membership history",
	{ timeout: 30000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			const spring = readCommunity(
				(await opened.model.snapshot()).document,
			).bundles.find((row) => row.id === 13);
			if (!spring) throw new Error("Missing spring bundle");
			// Include real completed/reward state rather than relying on empty flags.
			await opened.model.commands.transact(
				setCommunityProgress({
					type: "bundle",
					bundleKey: spring.key,
					value: true,
				}),
			);
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			await page.findByRole(
				"button",
				{ name: "Change route" },
				{ timeout: 10000 },
			);
			await fireEvent.click(
				page.getByRole("button", { name: /^Pantry Donations/ }),
			);
			const before = await opened.model.snapshot();
			expect(
				page.queryByRole("region", { name: "Joja development plan" }),
			).toBeNull();
			expect(page.queryByRole("tab")).toBeNull();
			await fireEvent.click(page.getByRole("button", { name: "Change route" }));
			let dialog = page.getByRole("dialog");
			expect(
				within(dialog)
					.getByRole("button", { name: "Switch to Community Center" })
					.hasAttribute("disabled"),
			).toBe(true);
			await fireEvent.click(
				within(dialog).getByRole("radio", { name: "Joja membership" }),
			);
			// Choosing a draft route does not reveal it or edit the save before commit.
			expect(
				page.queryByRole("region", { name: "Joja development plan" }),
			).toBeNull();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Cancel" }),
			);
			expect((await opened.model.snapshot()).entries).toEqual(before.entries);
			await fireEvent.click(page.getByRole("button", { name: "Change route" }));
			dialog = page.getByRole("dialog");
			await fireEvent.click(
				within(dialog).getByRole("radio", { name: "Joja membership" }),
			);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Switch to Joja" }),
			);
			await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
			expect(
				page.getByRole("region", { name: "Joja development plan" }),
			).toBeTruthy();
			expect(page.queryByRole("heading", { name: "Pantry" })).toBeNull();
			const after = await opened.model.snapshot();
			const progress = (document: typeof before.document) =>
				readCommunity(document).bundles.map((row) => ({
					key: row.key,
					requirements: row.requirements,
					rewardAvailable: row.rewardAvailable,
				}));
			expect(progress(after.document)).toEqual(progress(before.document));
			expect(after.document.SaveGame.player.items).toEqual(
				before.document.SaveGame.player.items,
			);
			expect(after.document.SaveGame.player.money).toBe(
				before.document.SaveGame.player.money,
			);
			// The secondary disclosure offers retained donations without presenting a
			// second active route. Happy DOM needs an explicit native toggle event.
			const details = page.getByText("Retained Community Center donations", {
				selector: "summary",
			}).parentElement;
			if (!(details instanceof HTMLDetailsElement))
				throw new Error("Missing retained donations");
			details.open = true;
			await fireEvent(details, new Event("toggle"));
			expect(await page.findByRole("heading", { name: "Pantry" })).toBeTruthy();
			expect((await opened.model.snapshot()).entries).toEqual(after.entries);
			await opened.model.commands.undo();
			await waitFor(() =>
				expect(
					page.queryByRole("region", { name: "Joja development plan" }),
				).toBeNull(),
			);
			expect(page.getByRole("heading", { name: "Pantry" })).toBeTruthy();
			await opened.model.commands.redo();
			await page.findByRole("region", { name: "Joja development plan" });
			expect(page.queryByRole("heading", { name: "Pantry" })).toBeNull();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it(
	"keeps a stale membership confirmation open without reversing a newer route",
	{ timeout: 20000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			await fireEvent.click(
				await page.findByRole("button", { name: "Change route" }),
			);
			await opened.model.commands.transact(
				setCommunityProgress({ type: "membership", value: true }),
			);
			const newer = await opened.model.snapshot();
			const dialog = page.getByRole("dialog");
			await fireEvent.click(
				within(dialog).getByRole("radio", { name: "Joja membership" }),
			);
			expect(
				within(dialog).getByRole("heading", {
					name: "Change restoration route",
				}),
			).toBeTruthy();
			await fireEvent.click(
				within(dialog).getByRole("button", {
					name: "Switch to Joja",
				}),
			);
			await waitFor(() =>
				expect(within(dialog).getByRole("alert").textContent).toContain(
					"Membership could not be changed",
				),
			);
			expect((await opened.model.snapshot()).document).toEqual(newer.document);
			expect((await opened.model.snapshot()).entries).toEqual(newer.entries);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it(
	"explains unknown membership and disables route-changing controls without normalizing the save",
	{ timeout: 20000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame.player, { mailReceived: true });
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			const before = await opened.model.snapshot();
			expect(readCommunity(before.document).membership).toBeUndefined();
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			expect(
				await page.findByRole("heading", {
					name: "Membership could not be read",
				}),
			).toBeTruthy();
			expect(
				page
					.getByRole("button", { name: "Change route" })
					.hasAttribute("disabled"),
			).toBe(true);
			expect(
				page
					.getAllByRole("checkbox")
					.every((control) => control.hasAttribute("disabled")),
			).toBe(true);
			expect(
				page.queryByRole("region", { name: "Joja development plan" }),
			).toBeNull();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it.each(["failure", "noncompletion"] as const)(
	"restores a native donation toggle after %s",
	{ timeout: 20000 },
	async (outcome) => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(WorkspaceHarness, { model: opened.model });
		const transact = vi
			.spyOn(opened.model.commands, "transact")
			.mockImplementation(async () =>
				outcome === "failure"
					? Result.fail(new MutationError("Donation rejected for this test."))
					: null,
			);
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
			const control = within(card).getAllByRole("checkbox")[0];
			if (!(control instanceof HTMLInputElement))
				throw new Error("Missing donation input");
			const original = control.checked,
				before = await opened.model.snapshot();
			await fireEvent.click(control);
			await waitFor(() => expect(control.checked).toBe(original));
			if (outcome === "failure")
				expect(within(card).getByRole("alert").textContent).toContain(
					"Donation rejected for this test.",
				);
			else expect(within(card).queryByRole("alert")).toBeNull();
			expect(within(card).getByText("Wild Horseradish")).toBeTruthy();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			transact.mockRestore();
			page.unmount();
			await opened.close();
		}
	},
);

it("keeps membership confirmation open while its command is pending", async () => {
	const opened = await openEditor(new TextEncoder().encode(fixtureXml));
	const page = render(WorkspaceHarness, { model: opened.model });
	let finish: (() => void) | undefined;
	const transact = vi
		.spyOn(opened.model.commands, "transact")
		.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = () => resolve(null);
				}),
		);
	try {
		await fireEvent.click(
			page.getByRole("link", { name: "Community Center & Joja" }),
		);
		await fireEvent.click(
			await page.findByRole(
				"button",
				{ name: "Change route" },
				{ timeout: 10000 },
			),
		);
		const dialog = page.getByRole("dialog");
		await fireEvent.click(
			within(dialog).getByRole("radio", { name: "Joja membership" }),
		);
		await fireEvent.click(
			within(dialog).getByRole("button", { name: "Switch to Joja" }),
		);
		// The owner locks every dismissal surface for the same pending commit.
		for (const name of ["Cancel", "Close dialog", "Switch to Joja"])
			expect(
				within(dialog).getByRole("button", { name }).hasAttribute("disabled"),
			).toBe(true);
		await fireEvent.keyDown(dialog, { key: "Escape" });
		expect(page.getByRole("dialog")).toBe(dialog);
		finish?.();
		await waitFor(() =>
			expect(
				within(dialog)
					.getByRole("button", { name: "Cancel" })
					.hasAttribute("disabled"),
			).toBe(false),
		);
		expect(page.getByRole("dialog")).toBe(dialog);
		await fireEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
	} finally {
		finish?.();
		transact.mockRestore();
		page.unmount();
		await opened.close();
	}
});

it.each(["failure", "noncompletion"] as const)(
	"restores a native Joja project toggle after %s",
	{ timeout: 20000 },
	async (outcome) => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		await opened.model.commands.transact(
			setCommunityProgress({ type: "membership", value: true }),
		);
		const page = render(WorkspaceHarness, { model: opened.model });
		const transact = vi
			.spyOn(opened.model.commands, "transact")
			.mockImplementation(async () =>
				outcome === "failure"
					? Result.fail(new MutationError("Project rejected for this test."))
					: null,
			);
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			const control = await page.findByRole(
				"checkbox",
				{ name: "Bridge project complete" },
				{ timeout: 10000 },
			);
			if (!(control instanceof HTMLInputElement))
				throw new Error("Missing project input");
			const original = control.checked,
				before = await opened.model.snapshot();
			await fireEvent.click(control);
			await waitFor(() => expect(control.checked).toBe(original));
			if (outcome === "failure")
				expect(page.getByRole("alert").textContent).toContain(
					"Project rejected for this test.",
				);
			else expect(page.queryByRole("alert")).toBeNull();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			transact.mockRestore();
			page.unmount();
			await opened.close();
		}
	},
);

it.each(["failure", "noncompletion"] as const)(
	"restores the native theater toggle after %s",
	{ timeout: 20000 },
	async (outcome) => {
		// Start with an already built Joja theater so reopening is available without
		// manufacturing five unrelated project transactions in this rejection test.
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame.player, {
			mailReceived: {
				string: ["JojaMember", "ccMovieTheater", "ccMovieTheaterJoja"],
			},
		});
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(WorkspaceHarness, { model: opened.model });
		const transact = vi
			.spyOn(opened.model.commands, "transact")
			.mockImplementation(async () =>
				outcome === "failure"
					? Result.fail(new MutationError("Theater rejected for this test."))
					: null,
			);
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Community Center & Joja" }),
			);
			const control = await page.findByRole(
				"checkbox",
				{ name: "Movie Theater project complete" },
				{ timeout: 10000 },
			);
			expect(control).toHaveProperty("checked", true);
			const before = await opened.model.snapshot();
			await fireEvent.click(control);
			await waitFor(() => expect(control).toHaveProperty("checked", true));
			if (outcome === "failure")
				expect(page.getByRole("alert").textContent).toContain(
					"Theater rejected for this test.",
				);
			else expect(page.queryByRole("alert")).toBeNull();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
		} finally {
			transact.mockRestore();
			page.unmount();
			await opened.close();
		}
	},
);
