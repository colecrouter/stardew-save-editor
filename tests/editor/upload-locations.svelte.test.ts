import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { Effect, Result } from "effect";
import UploadPanel from "../../src/lib/editor/ui/UploadPanel.svelte";
import {
	copySaveLocation,
	runEntryCommand,
} from "../../src/lib/editor/entry-operations";

const originalClipboard = Object.getOwnPropertyDescriptor(
	navigator,
	"clipboard",
);
afterEach(() => {
	if (originalClipboard)
		Object.defineProperty(navigator, "clipboard", originalClipboard);
	else Reflect.deleteProperty(navigator, "clipboard");
	vi.restoreAllMocks();
});
const clipboard = (writeText: (text: string) => Promise<void>) =>
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
const props = {
	opening: false,
	error: "",
	onfile: vi.fn(),
	onoriginal: vi.fn(),
	oncancel: vi.fn(),
};

it("copies a platform path without opening the file picker and keeps the path available for manual selection", async () => {
	const write = vi.fn(async () => {});
	clipboard(write);
	const open = vi.spyOn(HTMLInputElement.prototype, "click");
	render(UploadPanel, { props });
	await fireEvent.click(screen.getByText("Default save locations"));
	await fireEvent.click(
		screen.getByRole("button", { name: "Copy Windows save location" }),
	);
	await waitFor(() =>
		expect(screen.getByRole("status").textContent).toContain(
			"Copied Windows save location.",
		),
	);
	expect(write).toHaveBeenCalledWith(String.raw`%appdata%\StardewValley\Saves`);
	expect(
		screen.getByText(String.raw`%appdata%\StardewValley\Saves`).tagName,
	).toBe("CODE");
	expect(open).not.toHaveBeenCalled();
});

it("reports browser denial and allows copying another path without replacing the upload controls", async () => {
	const write = vi
		.fn()
		.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"))
		.mockResolvedValue(undefined);
	clipboard(write);
	render(UploadPanel, { props });
	await fireEvent.click(screen.getByText("Default save locations"));
	await fireEvent.click(
		screen.getByRole("button", { name: "Copy Linux save location" }),
	);
	await waitFor(() =>
		expect(screen.getByRole("alert").textContent).toContain(
			"Select it and copy it manually",
		),
	);
	await fireEvent.click(
		screen.getByRole("button", { name: "Copy macOS save location" }),
	);
	await waitFor(() =>
		expect(screen.getByRole("status").textContent).toContain(
			"Copied macOS save location.",
		),
	);
	expect(screen.getByLabelText("Save file").hasAttribute("disabled")).toBe(
		false,
	);
});

it("keeps absent clipboard support typed and programming failures at the shared entry boundary", async () => {
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: undefined,
	});
	expect(
		Result.isFailure(
			await Effect.runPromise(Effect.result(copySaveLocation("path"))),
		),
	).toBe(true);
	const report = vi.fn();
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	clipboard(async () => {
		throw new TypeError("broken implementation");
	});
	expect(
		await runEntryCommand(copySaveLocation("path"), report, {
			context: "clipboard",
			message: "Copy failed",
		}),
	).toBeNull();
	expect(report).toHaveBeenCalledExactlyOnceWith("Copy failed");
	expect(log).toHaveBeenCalledOnce();
});
