import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import { editorResources } from "../../src/lib/editor/editor-model";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import { fixtureXml, parser } from "./fixtures";

// Reject the actual stream phase, not just opening the picker. The same session
// must remain editable and a retry must export its latest state under its filename.
it.each(["write", "close"] as const)(
	"recovers from a browser %s failure without losing edits or backup feedback",
	{ timeout: 20000 },
	async (stage) => {
		const failure = new DOMException("Destination unavailable", "AbortError");
		const report = vi.spyOn(console, "error").mockImplementation(() => {});
		const abort = vi.fn(async () => {});
		const writes: Blob[] = [];
		let attempt = 0;
		const picker = vi.fn(async () => ({
			createWritable: async () => {
				const first = ++attempt === 1;
				return {
					write: async (blob: Blob) => {
						writes.push(blob);
						if (first && stage === "write") throw failure;
					},
					close: async () => {
						if (first && stage === "close") throw failure;
					},
					abort,
				};
			},
		}));
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		});
		const page = render(EditorApp, {
			backupOriginal: async () => {
				throw new DOMException("Archive unavailable", "QuotaExceededError");
			},
		});
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "Farm_123")] },
			});
			const exportButton = await page.findByRole("button", {
				name: "Export save",
			});
			await fireEvent.click(exportButton);
			await page.findByText(
				"The save could not be downloaded. Please try again.",
			);
			expect(abort).toHaveBeenCalledExactlyOnceWith(failure);
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			await fireEvent.input(page.getByRole("textbox", { name: "Farm name" }), {
				target: { value: "Retry Farm" },
			});
			await fireEvent.click(exportButton);
			await waitFor(() => {
				expect(attempt).toBe(2);
				expect(exportButton.hasAttribute("disabled")).toBe(false);
			});
			const last = writes.at(-1);
			if (!last) throw new Error("Missing retry bytes");
			expect(parser.parse(await last.text()).SaveGame.player.farmName).toBe(
				"Retry Farm",
			);
			expect(picker).toHaveBeenLastCalledWith(
				expect.objectContaining({ suggestedName: "Farm_123" }),
			);
			expect(
				page.queryByText("The save could not be downloaded. Please try again."),
			).toBeNull();
			expect(
				page.getByText(/The original file could not be backed up/),
			).toBeTruthy();
			expect(abort).toHaveBeenCalledOnce();
			expect(report).toHaveBeenCalledExactlyOnceWith(
				"Save download failed",
				failure,
			);
		} finally {
			page.unmount();
			report.mockRestore();
			Reflect.deleteProperty(window, "showSaveFilePicker");
			await waitFor(() =>
				expect(editorResources()).toEqual({
					models: 0,
					registries: 0,
					streams: 0,
				}),
			);
		}
	},
);
