import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import { openTestDocument } from "../helpers/open-editor.ts";
import WorkspaceHarness from "./WorkspaceHarness.svelte";
import { tinyEditorFixture } from "../helpers/editor-document.ts";

// Exercise real fields and commands: shortcuts must restore the actual save,
// preserve the typing gesture and disappear when the file workspace unmounts.
it.each([false, true])(
	"routes history shortcuts through the real workspace (Apple: %s)",
	{ timeout: 20000 },
	async (apple) => {
		const platform = vi
			.spyOn(navigator, "platform", "get")
			.mockReturnValue(apple ? "MacIntel" : "Win32");
		// Keyboard routing needs the real workspace, but no populated world.
		const opened = await openTestDocument(tinyEditorFixture());
		const page = render(WorkspaceHarness, { model: opened.model });
		const chord = {
			key: "z",
			ctrlKey: !apple,
			metaKey: apple,
			bubbles: true,
			cancelable: true,
		};
		try {
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			const field = page.getByRole("textbox", { name: "Farm name" });
			if (!(field instanceof HTMLInputElement))
				throw new Error("Missing farm name input");
			const original = field.value;
			// An empty stack must leave the browser's shortcut untouched.
			const unavailable = new KeyboardEvent("keydown", chord);
			window.dispatchEvent(unavailable);
			expect(unavailable.defaultPrevented).toBe(false);
			field.focus();
			await fireEvent.input(field, { target: { value: "Keyboard Farm" } });
			// Wait for the queued edit itself before checking its rendered toolbar state.
			await opened.model.snapshot();
			await waitFor(() =>
				expect(
					page.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
				).toBe(false),
			);
			const native = new KeyboardEvent("keydown", chord);
			field.dispatchEvent(native);
			expect(native.defaultPrevented).toBe(false);
			expect(field.value).toBe("Keyboard Farm");
			field.blur();
			page.getByRole("link", { name: "Farm settings" }).focus();
			const undo = page.getByRole("button", { name: "Undo" });
			expect(undo.getAttribute("aria-keyshortcuts")).toBe(
				apple ? "Meta+Z" : "Control+Z",
			);
			expect(undo.title).toContain(apple ? "⌘Z" : "Ctrl+Z");
			expect(await fireEvent.keyDown(window, chord)).toBe(false);
			await waitFor(() => expect(field.value).toBe(original));
			expect(
				await fireEvent.keyDown(window, { ...chord, shiftKey: true }),
			).toBe(false);
			await waitFor(() => expect(field.value).toBe("Keyboard Farm"));
			page.unmount();
			const afterClose = new KeyboardEvent("keydown", chord);
			window.dispatchEvent(afterClose);
			expect(afterClose.defaultPrevented).toBe(false);
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.farmName,
			).toBe("Keyboard Farm");
		} finally {
			page.unmount();
			await opened.close();
			platform.mockRestore();
		}
	},
);
