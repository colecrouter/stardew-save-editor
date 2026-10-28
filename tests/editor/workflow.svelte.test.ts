import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { editorResources } from "../../src/lib/editor/editor-model";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import { fixtureXml } from "./fixtures";

// These integration scenarios repeatedly parse or export the 6.6 MB save fixture.
// Match the calendar suites’ CI budget: assertions verify preservation and workflow,
// while the default unit-test timeout remains unchanged.
describe("full-save application workflow", { timeout: 15_000 }, () => {
	it("the migrated UI imports, stages one date action, reviews, undoes and closes its session", async () => {
		const backupOriginal = vi.fn(async () => {});
		const page = render(EditorApp, {
			props: { legacyHref: "/", backupOriginal },
		});
		try {
			const input = page.getByLabelText("Save file") as HTMLInputElement;
			const file = new File([fixtureXml], "Farm_123");
			await fireEvent.change(input, { target: { files: [file] } });
			await waitFor(
				() =>
					expect(page.getByRole("spinbutton", { name: "Year" })).toBeTruthy(),
				{ timeout: 5000 },
			);
			await waitFor(() => expect(backupOriginal).toHaveBeenCalledWith(file));
			expect(page.queryByRole("link", { name: "Bundles" })).toBeNull();
			const year = page.getByRole("spinbutton", {
				name: "Year",
			}) as HTMLInputElement;
			await fireEvent.input(year, { target: { value: "3" } });
			expect(
				page
					.getByRole("button", { name: "Export save" })
					.hasAttribute("disabled"),
			).toBe(true);
			await fireEvent.click(page.getByRole("button", { name: "Apply date" }));
			await waitFor(
				() => expect(page.getByText(/Current save:.*Year 3/)).toBeTruthy(),
				{ timeout: 5000 },
			);
			await fireEvent.click(page.getByRole("link", { name: "Review changes" }));
			expect(page.getByText("Edit history")).toBeTruthy();
			expect(
				page.queryByRole("button", { name: "Reverse backpack" }),
			).toBeNull();
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(
				() =>
					expect(
						page.getByText("No exported changes from the imported save."),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			await fireEvent.click(page.getByRole("button", { name: "Exit" }));
			await waitFor(() =>
				expect(editorResources()).toEqual({
					models: 0,
					registries: 0,
					streams: 0,
				}),
			);
			expect(page.getByLabelText("Save file")).toBeTruthy();
		} finally {
			page.unmount();
		}
	});

	it("an unreadable compressed file leaves the upload usable for another attempt", async () => {
		const page = render(EditorApp);
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File(["xyz"], "BadFarm")] },
			});
			await waitFor(() =>
				expect(page.getByRole("alert").textContent).toContain(
					"could not be decompressed",
				),
			);
			expect(page.getByLabelText("Save file").hasAttribute("disabled")).toBe(
				false,
			);
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
		const report = vi.spyOn(console, "error").mockImplementation(() => {});
		const picker = vi
			.fn()
			.mockRejectedValueOnce(new Error("Browser write failed"))
			.mockResolvedValue({
				createWritable: async () => ({
					write: async () => {},
					close: async () => {},
				}),
			});
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		});
		const page = render(EditorApp, {
			props: {
				backupOriginal: async () => {
					throw Error("Backup unavailable");
				},
			},
		});
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "Farm_123")] },
			});
			await waitFor(
				() =>
					expect(
						page.getByRole("button", { name: "Export save" }),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(
				() =>
					expect(
						page.getByText(
							"The save could not be downloaded. Please try again.",
						),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(() => expect(picker).toHaveBeenCalledTimes(2), {
				timeout: 5000,
			});
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
