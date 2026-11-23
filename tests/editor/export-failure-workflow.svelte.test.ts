import * as Sentry from "@sentry/sveltekit";
import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";

import { editorResources } from "../../src/lib/editor/editor-model";
import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import {
	exportDocument,
	parser,
	tinyEditorFixture,
} from "../helpers/editor-document.ts";

// Keep real scope isolation while replacing the ESM logger namespace's sink.
// No test needs a configured client or a network connection to inspect outcomes.
vi.mock("@sentry/sveltekit", async (original) => {
	const sentry = await original<typeof Sentry>();
	return { ...sentry, logger: { ...sentry.logger, info: vi.fn<() => void>() } };
});

// A small valid farm still passes through the real import/export codec and
// readback validation. These cases exercise browser-stream recovery; full-save
// preservation belongs to the dedicated application and roundtrip scenarios.
// Allow asynchronous UI publication the same bounded settling time as nearby
// lifecycle tests, without tying recovery correctness to large-file throughput.
const waitForIO = <T>(assertion: () => T) => waitFor(assertion);

// Reject the actual stream phase, not just opening the picker. The same session
// must remain editable and a retry must export its latest state under its filename.
it.each([
	"write",
	"close",
	"picker",
	"NotFoundError",
	"NotAllowedError",
	"InvalidStateError",
] as const)(
	"recovers from a browser %s failure without losing edits or backup feedback",
	async (stage) => {
		// Native destination failures can happen before a stream exists. These
		// cases must offer a route that does not acquire the same kind of handle.
		const acquisitionFailure = stage !== "write" && stage !== "close";
		const failure = new DOMException(
			"Destination unavailable",
			stage === "picker"
				? "NotFoundError"
				: acquisitionFailure
					? stage
					: "AbortError",
		);
		// Observe metadata at capture time: it must describe this attempt only,
		// without retaining the selected filename, bytes or browser handle.
		const captured: ReturnType<
			ReturnType<typeof Sentry.getCurrentScope>["getScopeData"]
		>[] = [];
		const report = vi.spyOn(console, "error").mockImplementation(() => {
			captured.push(Sentry.getCurrentScope().getScopeData());
		});
		const outcomes = vi.mocked(Sentry.logger.info);
		outcomes.mockClear();
		const abort = vi.fn<() => Promise<void>>(() => Promise.resolve());
		const writes: Blob[] = [];
		const create = vi
			.spyOn(URL, "createObjectURL")
			.mockImplementation((blob) => {
				if (!(blob instanceof Blob)) throw new Error("Expected save bytes");
				writes.push(blob);
				return "blob:recovery-save";
			});
		const revoke = vi
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => {});
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(function (this: HTMLAnchorElement) {
				expect(this.download).toBe("Farm_123");
				expect(this.isConnected).toBe(true);
			});
		let attempt = 0;
		// Each attempt owns a fresh stream; the first attempt fails at the selected stage.
		type TestWritable = {
			write: (blob: Blob) => Promise<void>;
			close: () => Promise<void>;
			abort: typeof abort;
		};
		const createWritable = (): Promise<TestWritable> => {
			const first = ++attempt === 1;
			if (acquisitionFailure) return Promise.reject(failure);
			return Promise.resolve({
				write: (blob: Blob) => {
					writes.push(blob);
					return first && stage === "write"
						? Promise.reject(failure)
						: Promise.resolve();
				},
				close: () =>
					first && stage === "close"
						? Promise.reject(failure)
						: Promise.resolve(),
				abort,
			});
		};
		let pickerAttempts = 0;
		const picker = vi.fn<
			() => Promise<{ createWritable: typeof createWritable }>
		>(() => {
			pickerAttempts++;
			if (stage !== "picker") return Promise.resolve({ createWritable });
			// The second picker opening is dismissed before the user chooses
			// the fallback. Cancellation must keep the original recovery visible.
			return Promise.reject(
				pickerAttempts === 1
					? failure
					: new DOMException("Dismissed", "AbortError"),
			);
		});
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		});
		const page = render(EditorApp, {
			processingLayer: SaveProcessingSync,
			backupOriginal: () => {
				return Promise.reject(
					new DOMException("Archive unavailable", "QuotaExceededError"),
				);
			},
		});
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: {
					files: [new File([exportDocument(tinyEditorFixture())], "Farm_123")],
				},
			});
			const exportButton = await page.findByRole("button", {
				name: "Export save",
			});
			await fireEvent.click(exportButton);
			// The toast offers both actions independently of the main toolbar.
			const toast = await page.findByRole("region", {
				name: "Export recovery",
			});
			const retryButton = page.getByRole("button", {
				name: "Try exporting again",
			});
			const message =
				stage === "picker"
					? "The save picker couldn't open."
					: "The edited save couldn't be written to the selected file.";
			const feedback = await page.findByText(
				`${message} Your edits are still open.`,
			);
			expect(toast.contains(feedback)).toBe(true);
			expect(
				toast.contains(page.getByRole("button", { name: "Download a copy" })),
			).toBe(true);
			expect(toast.contains(retryButton)).toBe(true);
			expect(abort.mock.calls).toEqual(acquisitionFailure ? [] : [[failure]]);
			// Dismiss the retry in the picker case. Recovery must still be
			// available after the attempted action has settled.
			if (stage === "picker") await fireEvent.click(retryButton);
			await waitForIO(() => {
				expect(picker).toHaveBeenCalledTimes(stage === "picker" ? 2 : 1);
				expect(exportButton.hasAttribute("disabled")).toBe(false);
			});
			expect(toast.contains(feedback)).toBe(true);
			expect(
				page.getByRole("button", { name: "Download a copy" }),
			).toBeTruthy();
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			await fireEvent.input(page.getByRole("textbox", { name: "Farm name" }), {
				target: { value: "Retry Farm" },
			});
			// Recovery must serialize edits made after the failed attempt, rather
			// than downloading cached bytes or reopening the failing picker.
			await fireEvent.click(
				acquisitionFailure
					? page.getByRole("button", { name: "Download a copy" })
					: retryButton,
			);
			await waitForIO(() => {
				expect(attempt).toBe(
					stage === "picker" ? 0 : acquisitionFailure ? 1 : 2,
				);
				expect(writes.length).toBeGreaterThan(0);
				expect(exportButton.hasAttribute("disabled")).toBe(false);
			});
			const last = writes.at(-1);
			if (!last) throw new Error("Missing retry bytes");
			expect(parser.parse(await last.text()).SaveGame.player.farmName).toBe(
				"Retry Farm",
			);
			// Vitest types asymmetric matchers as any. Keep expected matcher values
			// unknown so they cannot weaken the surrounding saved-data assertions.
			expect(picker).toHaveBeenLastCalledWith(
				expect.objectContaining({ suggestedName: "Farm_123" }) as unknown,
			);
			expect(picker).toHaveBeenCalledTimes(
				acquisitionFailure && stage !== "picker" ? 1 : 2,
			);
			expect(
				page.queryByText(`${message} Your edits are still open.`),
			).toBeNull();
			expect(
				page.getByText(/The original file could not be backed up/),
			).toBeTruthy();
			expect(abort).toHaveBeenCalledTimes(acquisitionFailure ? 0 : 1);
			expect(report).toHaveBeenCalledExactlyOnceWith(
				"Save download failed",
				failure,
			);
			expect(captured[0]?.tags).toMatchObject({
				"save_download.stage":
					stage === "picker"
						? "picker"
						: acquisitionFailure
							? "create_writable"
							: stage,
				"save_download.mode": "picker",
				"save_download.error_name": failure.name,
			});
			expect(captured[0]?.contexts["save_download"]).toEqual({
				stage:
					stage === "picker"
						? "picker"
						: acquisitionFailure
							? "create_writable"
							: stage,
				mode: "picker",
				duration_ms: expect.any(Number) as unknown,
			});
			expect(
				Sentry.getCurrentScope().getScopeData().tags["save_download.stage"],
			).toBeUndefined();
			expect(outcomes).toHaveBeenLastCalledWith("Save download outcome", {
				mode: acquisitionFailure ? "download" : "picker",
				stage: acquisitionFailure ? "download" : "close",
				duration_ms: expect.any(Number) as unknown,
				outcome: acquisitionFailure ? "download_started" : "written",
			});
		} finally {
			page.unmount();
			// Standard downloads retain their URL briefly for WebKit. Let their
			// owned cleanup finish before restoring browser methods for other tests.
			await waitForIO(() =>
				expect(revoke).toHaveBeenCalledTimes(create.mock.calls.length),
			);
			create.mockRestore();
			revoke.mockRestore();
			click.mockRestore();
			report.mockRestore();
			outcomes.mockClear();
			Reflect.deleteProperty(window, "showSaveFilePicker");
			await waitForIO(() =>
				expect(editorResources()).toEqual({
					models: 0,
					registries: 0,
					streams: 0,
				}),
			);
		}
	},
);
