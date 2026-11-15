import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { editorResources } from "../../src/lib/editor/editor-model";
import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import { requireInstance } from "../helpers/assertions.ts";
import {
	exportDocument,
	tinyEditorFixture,
} from "../helpers/editor-document.ts";
import { fixtureXml } from "./fixtures";

// These integration scenarios repeatedly parse or export the 6.6 MB save fixture.
// These full-save assertions verify preservation and workflow, not latency.
// The shared runner deadline covers codec work under normal test concurrency.
describe("full-save application workflow", () => {
	it("the migrated UI imports, stages one date action, reviews, undoes and closes its session", async () => {
		const backupOriginal = vi.fn<() => Promise<void>>(() => Promise.resolve());
		const page = render(EditorApp, {
			props: {
				processingLayer: SaveProcessingSync,
				legacyHref: "/",
				backupOriginal,
			},
		});
		try {
			const input = requireInstance(
				page.getByLabelText("Save file"),
				HTMLInputElement,
			);
			const file = new File([fixtureXml], "Farm_123");
			await fireEvent.change(input, { target: { files: [file] } });
			await waitFor(() =>
				expect(page.getByRole("spinbutton", { name: "Year" })).toBeTruthy(),
			);
			await waitFor(() => expect(backupOriginal).toHaveBeenCalledWith(file));
			expect(page.queryByRole("link", { name: "Bundles" })).toBeNull();
			const year = requireInstance(
				page.getByRole("spinbutton", {
					name: "Year",
				}),
				HTMLInputElement,
			);
			await fireEvent.input(year, { target: { value: "3" } });
			expect(
				page
					.getByRole("button", { name: "Export save" })
					.hasAttribute("disabled"),
			).toBe(true);
			await fireEvent.click(page.getByRole("button", { name: "Apply date" }));
			await waitFor(() =>
				expect(page.getByText(/Current save:.*Year 3/)).toBeTruthy(),
			);
			await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
			expect(page.getByText("Edit history")).toBeTruthy();
			expect(
				page.queryByRole("button", { name: "Reverse backpack" }),
			).toBeNull();
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() =>
				expect(
					page.getByText("No exported changes from the imported save."),
				).toBeTruthy(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Exit" }));
			await waitFor(() =>
				expect(editorResources()).toEqual({
					models: 0,
					registries: 0,
					streams: 0,
				}),
			);
			expect(
				requireInstance(page.getByLabelText("Save file"), HTMLInputElement),
			).toBeTruthy();
		} finally {
			page.unmount();
		}
	});

	it("an unreadable compressed file leaves the upload usable for another attempt", async () => {
		const page = render(EditorApp, { processingLayer: SaveProcessingSync });
		try {
			await fireEvent.change(
				requireInstance(page.getByLabelText("Save file"), HTMLInputElement),
				{
					target: { files: [new File(["xyz"], "BadFarm")] },
				},
			);
			await waitFor(() =>
				expect(page.getByRole("alert").textContent).toContain(
					"could not be decompressed",
				),
			);
			expect(
				requireInstance(
					page.getByLabelText("Save file"),
					HTMLInputElement,
				).hasAttribute("disabled"),
			).toBe(false);
			expect(editorResources()).toEqual({
				models: 0,
				registries: 0,
				streams: 0,
			});
		} finally {
			page.unmount();
		}
	});

	it("a failed browser write can be retried without clearing an independent backup warning", async () => {
		// Retry ownership needs real export I/O, not a full-size farm.
		const report = vi.spyOn(console, "error").mockImplementation(() => {});
		const picker = vi
			.fn<
				() => Promise<{
					createWritable: () => Promise<{
						write: () => Promise<void>;
						close: () => Promise<void>;
					}>;
				}>
			>()
			.mockRejectedValueOnce(new Error("Browser write failed"))
			.mockResolvedValue({
				createWritable: () =>
					Promise.resolve({
						write: () => Promise.resolve(),
						close: () => Promise.resolve(),
					}),
			});
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		});
		const page = render(EditorApp, {
			props: {
				processingLayer: SaveProcessingSync,
				backupOriginal: () => {
					return Promise.reject(
						new DOMException("Backup unavailable", "QuotaExceededError"),
					);
				},
			},
		});
		try {
			await fireEvent.change(
				requireInstance(page.getByLabelText("Save file"), HTMLInputElement),
				{
					target: {
						files: [
							new File([exportDocument(tinyEditorFixture())], "Farm_123"),
						],
					},
				},
			);
			await waitFor(() =>
				expect(page.getByRole("button", { name: "Export save" })).toBeTruthy(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(() =>
				expect(
					page.getByText("The save could not be downloaded. Please try again."),
				).toBeTruthy(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(() => expect(picker).toHaveBeenCalledTimes(2));
			await waitFor(() =>
				expect(
					page
						.getByRole("button", { name: "Export save" })
						.hasAttribute("disabled"),
				).toBe(false),
			);
			expect(
				page.queryByText("The save could not be downloaded. Please try again."),
			).toBeNull();
			expect(
				page.getByText(/The original file could not be backed up/),
			).toBeTruthy();
			expect(report).toHaveBeenCalledOnce();
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
	});
});
