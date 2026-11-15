import { expect, it, vi } from "vitest";

import { requireInstance } from "../helpers/assertions.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderBrowserWorkspace } from "./workspace-browser.ts";

// Exercise real fields and commands: shortcuts must restore the actual save,
// preserve the typing gesture and disappear when the file workspace unmounts.
it.each([false, true])(
	"routes history shortcuts through the real workspace (Apple: %s)",
	async (apple) => {
		const platform = vi
			.spyOn(navigator, "platform", "get")
			.mockReturnValue(apple ? "MacIntel" : "Win32");
		const opened = await renderBrowserWorkspace(
			tinyEditorFixture(),
			"Farm settings",
		);
		const chord = {
			key: "z",
			ctrlKey: !apple,
			metaKey: apple,
			bubbles: true,
			cancelable: true,
		};
		try {
			const { page, model } = opened;
			const field = page.getByRole("textbox", { name: "Farm name" });
			const original = requireInstance(field.element(), HTMLInputElement).value;
			// Inspect cancelable events directly to distinguish browser-owned shortcuts
			// from workspace-owned ones; filling and focus changes still use real input.
			const unavailable = new KeyboardEvent("keydown", chord);
			window.dispatchEvent(unavailable);
			expect(unavailable.defaultPrevented).toBe(false);
			await field.fill("Keyboard Farm");
			await model.snapshot();
			const undo = page.getByRole("button", { name: "Undo" });
			await expect.element(undo).toBeEnabled();
			const native = new KeyboardEvent("keydown", chord);
			field.element().dispatchEvent(native);
			expect(native.defaultPrevented).toBe(false);
			await expect.element(field).toHaveValue("Keyboard Farm");
			await page.getByRole("link", { name: "Farm settings" }).click();
			await expect
				.element(undo)
				.toHaveAttribute("aria-keyshortcuts", apple ? "Meta+Z" : "Control+Z");
			expect(undo.element().getAttribute("title")).toContain(
				apple ? "⌘Z" : "Ctrl+Z",
			);
			const undoEvent = new KeyboardEvent("keydown", chord);
			window.dispatchEvent(undoEvent);
			expect(undoEvent.defaultPrevented).toBe(true);
			await expect.element(field).toHaveValue(original);
			const redoEvent = new KeyboardEvent("keydown", {
				...chord,
				shiftKey: true,
			});
			window.dispatchEvent(redoEvent);
			expect(redoEvent.defaultPrevented).toBe(true);
			await expect.element(field).toHaveValue("Keyboard Farm");
			await page.unmount();
			const afterClose = new KeyboardEvent("keydown", chord);
			window.dispatchEvent(afterClose);
			expect(afterClose.defaultPrevented).toBe(false);
			expect((await model.snapshot()).document.SaveGame.player.farmName).toBe(
				"Keyboard Farm",
			);
		} finally {
			await opened.dispose();
			platform.mockRestore();
		}
	},
);
