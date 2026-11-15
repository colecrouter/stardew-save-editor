import { expect, it } from "vitest";
import { page as browser } from "vitest/browser";

import { requireInstance } from "../helpers/assertions.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderBrowserWorkspace } from "./workspace-browser.ts";

// A select does not dispatch the sidebar's click handler. Exercise lazy mounting
// and field-gesture closure through the responsive picker's actual user flow.
it("navigates with the section picker and retains one Undo entry for a completed field gesture", async () => {
	// The picker is the phone navigation control; desktop uses sidebar links.
	await browser.viewport(600, 900);
	const opened = await renderBrowserWorkspace(tinyEditorFixture());
	try {
		const { page, model } = opened;
		const picker = page.getByLabelText("Section", { exact: true });
		await picker.selectOptions("inventory");
		// The locator assertion covers asynchronous preparation of the lazy panel.
		await expect
			.element(page.getByRole("heading", { name: "Inventory" }))
			.toBeVisible();
		await picker.selectOptions("farm");
		const name = page.getByRole("textbox", { name: "Farm name" });
		await expect.element(name).toBeVisible();
		const original = requireInstance(name.element(), HTMLInputElement).value;
		await name.fill("Visual");
		await expect
			.poll(async () => (await model.snapshot()).entries.length)
			.toBe(1);
		await name.fill("Visual QA");
		// Selecting another panel performs native blur and closes the active gesture.
		await picker.selectOptions("review");
		await expect
			.element(page.getByRole("heading", { name: "Review changes" }))
			.toBeVisible();
		await model.commands.undo();
		await picker.selectOptions("farm");
		await expect.element(name).toHaveValue(original);
		await expect
			.element(page.getByRole("button", { name: "Undo" }))
			.toBeDisabled();
	} finally {
		await opened.dispose();
	}
});
