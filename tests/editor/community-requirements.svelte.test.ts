import { expect, it } from "vitest";
import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { openEditor } from "../../src/lib/editor/editor-model";
import { readCommunity } from "../../src/lib/editor/community-data";
import WorkspaceHarness from "./WorkspaceHarness.svelte";
import { fixtureXml } from "./fixtures";
import { setCommunityProgress } from "../../src/lib/editor/community-operations";
import { ingredientName } from "../../src/lib/editor/community-ingredients";
import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";

it(
	"keeps requirement drafts cancellable and commits one undoable transaction",
	{ timeout: 30000 },
	async () => {
		const opened = await openEditor(
			SaveProcessingSync,
			new TextEncoder().encode(fixtureXml),
		);
		const page = render(WorkspaceHarness, { model: opened.model });
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

it(
	"reorders whole draft requirements by keyboard and dragging, then adds/removes without losing donation ownership",
	{ timeout: 30000 },
	async () => {
		const opened = await openEditor(
			SaveProcessingSync,
			new TextEncoder().encode(fixtureXml),
		);
		const initial = readCommunity(
			(await opened.model.snapshot()).document,
		).bundles.find((row) => row.id === 13);
		const first = initial?.requirements[0];
		if (!initial || !first) throw new Error("Missing Spring Foraging fixture");
		await opened.model.commands.transact(
			setCommunityProgress({
				type: "donation",
				bundleKey: initial.key,
				index: 0,
				itemId: first.itemId,
				quantity: first.quantity,
				quality: first.quality,
				value: true,
			}),
		);
		const before = await opened.model.snapshot();
		const original = readCommunity(before.document).bundles.find(
			(row) => row.id === 13,
		);
		if (!original) throw new Error("Missing donated bundle");
		const page = render(WorkspaceHarness, { model: opened.model });
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
			await fireEvent.click(
				within(card).getByRole("button", { name: "Edit requirements" }),
			);
			const dialog = page.getByRole("dialog");
			expect(
				within(dialog).queryByRole("button", { name: /Change requirement/ }),
			).toBeNull();
			const firstName = ingredientName(first.itemId);
			expect(within(dialog).getByText(firstName).tagName).toBe("SPAN");
			const handle = within(dialog).getByRole("button", {
				name: `Reorder requirement 1: ${firstName}`,
			});
			await fireEvent.keyDown(handle, { key: "ArrowDown" });
			expect(
				within(dialog).getByRole("button", {
					name: `Reorder requirement 2: ${firstName}`,
				}),
			).toBe(handle);
			// Native drag data contains no authority over the save. The captured row
			// identity must carry its donated state through the same draft operation.
			const dataTransfer = {
				setData: () => {},
				effectAllowed: "",
				dropEffect: "",
			};
			const source = within(dialog).getByRole("group", {
				name: `Requirement 2: ${firstName}`,
			});
			// Native control gestures must not be stolen by the row's drag surface.
			await fireEvent.pointerDown(within(source).getByRole("spinbutton"));
			expect(await fireEvent.dragStart(source, { dataTransfer })).toBe(false);
			// Start on the item name rather than the handle to exercise whole-row dragging.
			await fireEvent.pointerDown(within(source).getByText(firstName));
			await fireEvent.dragStart(source, { dataTransfer });
			const target = within(dialog).getByRole("group", {
				name: /^Requirement 3:/,
			});
			await fireEvent.dragOver(target, { dataTransfer });
			await fireEvent.drop(target, { dataTransfer });
			expect(
				within(dialog).getByRole("button", {
					name: `Reorder requirement 3: ${firstName}`,
				}),
			).toBe(handle);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Add requirement" }),
			);
			// Merely opening item choices must not append a placeholder or mutate history.
			expect(
				within(dialog).getAllByRole("group", { name: /^Requirement \d+:/ }),
			).toHaveLength(4);
			await fireEvent.input(
				within(dialog).getByRole("searchbox", {
					name: "Search items or categories",
				}),
				{ target: { value: "Parsnip" } },
			);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Parsnip" }),
			);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Remove requirement 4" }),
			);
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await fireEvent.click(
				within(dialog).getByRole("button", { name: "Apply requirements" }),
			);
			await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
			const after = await opened.model.snapshot();
			const changed = readCommunity(after.document).bundles.find(
				(row) => row.id === 13,
			);
			expect(changed?.requirements.map((row) => row.itemId)).toEqual([
				original.requirements[1]?.itemId,
				original.requirements[2]?.itemId,
				first.itemId,
				"24",
			]);
			expect(changed?.requirements.map((row) => row.submitted)).toEqual([
				false,
				false,
				true,
				false,
			]);
			expect(after.entries.length).toBe(before.entries.length + 1);
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await opened.model.commands.redo();
			expect((await opened.model.snapshot()).document).toEqual(after.document);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
