import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openTestDocument } from "../helpers/open-editor.ts";
import WorkspaceHarness from "./WorkspaceHarness.svelte";
import { tinyEditorFixture } from "../helpers/editor-document.ts";

// A select does not dispatch the sidebar's click handler. Exercise lazy mounting
// and field-gesture closure through that alternative route with a real session.
it(
	"navigates with the section picker and retains one Undo entry for a completed field gesture",
	{ timeout: 20000 },
	async () => {
		// Navigation and gesture closure do not depend on a populated farm.
		const opened = await openTestDocument(tinyEditorFixture());
		const page = render(WorkspaceHarness, { model: opened.model });
		try {
			const picker = page.getByLabelText("Section", { exact: true });
			await fireEvent.change(picker, { target: { value: "inventory" } });
			// Inventory is lazy-loaded; allow its module to mount under parallel CI work.
			await page.findByRole(
				"heading",
				{ name: "Inventory" },
				{ timeout: 5000 },
			);
			await fireEvent.change(picker, { target: { value: "farm" } });
			const name = page.getByRole("textbox", {
				name: "Farm name",
			});
			if (!(name instanceof HTMLInputElement))
				throw new Error("Missing farm-name input");
			const original = name.value;
			await fireEvent.focus(name);
			await fireEvent.input(name, { target: { value: "Visual" } });
			await waitFor(async () =>
				expect((await opened.model.snapshot()).entries).toHaveLength(1),
			);
			await fireEvent.input(name, { target: { value: "Visual QA" } });
			// Navigation finishes the active gesture even when a native blur is absent.
			await fireEvent.change(picker, { target: { value: "review" } });
			await waitFor(() =>
				expect(
					page.getByRole("heading", { name: "Review changes" }),
				).toBeTruthy(),
			);
			await opened.model.commands.undo();
			await fireEvent.change(picker, { target: { value: "farm" } });
			await waitFor(() => expect(name.value).toBe(original));
			expect(
				page.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
			).toBe(true);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
