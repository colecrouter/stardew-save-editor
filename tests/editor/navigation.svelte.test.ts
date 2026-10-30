import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import CharacterHarness from "./CharacterHarness.svelte";
import { fixtureXml } from "./fixtures";

// A select does not dispatch the sidebar's click handler. Exercise lazy mounting
// and field-gesture closure through that alternative route with a real session.
it(
	"navigates with the section picker and retains one Undo entry for a completed field gesture",
	{ timeout: 20000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(CharacterHarness, { model: opened.model });
		try {
			const picker = page.getByLabelText("Section", { exact: true });
			await fireEvent.change(picker, { target: { value: "inventory" } });
			await waitFor(() =>
				expect(page.getByRole("heading", { name: "Inventory" })).toBeTruthy(),
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
