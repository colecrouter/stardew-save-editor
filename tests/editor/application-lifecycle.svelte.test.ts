import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { expect, it, type Mock, vi } from "vitest";

import * as editor from "../../src/lib/editor/editor-model";
import { editorResources } from "../../src/lib/editor/editor-model";
import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import {
	exportDocument,
	tinyEditorFixture,
} from "../helpers/editor-document.ts";

// These races require real sessions and export I/O, but no populated farm.
const fixtureXml = exportDocument(tinyEditorFixture());

// These assertions wait on full-save import/export as well as browser promises.
const waitForIO = <T>(assertion: () => T) => waitFor(assertion);

const released = () =>
	expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });

// Teardown must cancel a pending stream read before any session is installed.
// A producer that finishes late cannot revive the abandoned import or back it up.
it("ignores a stream read that finishes after application teardown", async () => {
	const pending = Promise.withResolvers<void>();
	const file = new File([fixtureXml], "LateFarm");
	let cancelled = false;
	const cancel = vi.fn<() => void>(() => {
		cancelled = true;
	});
	const read = vi.fn<
		(
			controller: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>,
		) => Promise<void>
	>(
		async (
			controller: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>,
		) => {
			await pending.promise;
			if (!cancelled) {
				controller.enqueue(new TextEncoder().encode(fixtureXml));
				controller.close();
			}
		},
	);
	const stream = vi
		.spyOn(file, "stream")
		.mockReturnValue(new ReadableStream({ pull: read, cancel }));
	const backup = vi.fn<() => Promise<void>>(() => Promise.resolve());
	const page = render(EditorApp, {
		processingLayer: SaveProcessingSync,
		backupOriginal: backup,
	});
	try {
		await fireEvent.change(page.getByLabelText("Save file"), {
			target: { files: [file] },
		});
		// Wait for the import to acquire this stream, not its automatic prefetch.
		await waitForIO(() => expect(stream).toHaveBeenCalledOnce());
		expect(read).toHaveBeenCalledOnce();
		page.unmount();
		await waitForIO(() => expect(cancel).toHaveBeenCalledOnce());
		pending.resolve();
		await pending.promise;
		await tick();
		await waitForIO(released);
		expect(backup).not.toHaveBeenCalled();
	} finally {
		page.unmount();
		pending.resolve();
		stream.mockRestore();
	}
});

// Exit may happen while the browser owns a picker or is acquiring its stream.
// A late resolution must not write the abandoned session or affect its successor.
it.each(["picker", "stream"] as const)(
	"suppresses a late %s acquisition after Exit while the next save stays usable",
	async (stage) => {
		const acquisition = Promise.withResolvers<void>();
		const write = vi.fn<() => Promise<void>>(() => Promise.resolve()),
			close = vi.fn<() => Promise<void>>(() => Promise.resolve()),
			abort = vi.fn<() => Promise<void>>(() => Promise.resolve());
		const writable = { write, close, abort };
		const createWritable = vi.fn<
			() => Promise<{
				write: Mock<() => Promise<void>>;
				close: Mock<() => Promise<void>>;
				abort: Mock<() => Promise<void>>;
			}>
		>(async () => {
			if (stage === "stream") await acquisition.promise;
			return writable;
		});
		const picker = vi.fn<
			() => Promise<{
				createWritable: Mock<
					() => Promise<{
						write: Mock<() => Promise<void>>;
						close: Mock<() => Promise<void>>;
						abort: Mock<() => Promise<void>>;
					}>
				>;
			}>
		>(async () => {
			if (stage === "picker") await acquisition.promise;
			return { createWritable };
		});
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		});
		const page = render(EditorApp, { processingLayer: SaveProcessingSync });
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "FirstFarm")] },
			});
			await waitForIO(() =>
				expect(page.getByRole("button", { name: "Export save" })).toBeTruthy(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitForIO(() =>
				expect(
					stage === "stream" ? createWritable : picker,
				).toHaveBeenCalledOnce(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Exit" }));
			await waitForIO(released);
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "SecondFarm")] },
			});
			await waitForIO(() =>
				expect(page.getByRole("button", { name: "Export save" })).toBeTruthy(),
			);
			acquisition.resolve();
			await acquisition.promise;
			await tick();
			await waitForIO(() =>
				expect(abort).toHaveBeenCalledTimes(stage === "stream" ? 1 : 0),
			);
			expect(createWritable).toHaveBeenCalledTimes(stage === "stream" ? 1 : 0);
			expect(write).not.toHaveBeenCalled();
			expect(close).not.toHaveBeenCalled();
			// The prior export's finally block must not disable the replacement's export.
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitForIO(() => expect(write).toHaveBeenCalledOnce());
			await waitForIO(() => expect(close).toHaveBeenCalledOnce());
			expect(page.queryByRole("alert")).toBeNull();
		} finally {
			acquisition.resolve();
			page.unmount();
			Reflect.deleteProperty(window, "showSaveFilePicker");
			await waitForIO(released);
		}
	},
);

// Acquisition may already have succeeded when teardown invalidates its delivery.
// The generation guard must close that real session instead of installing it.
it("closes an acquired session delivered after application teardown", async () => {
	// Capture the real export before replacing the hoisted module spy. Saving
	// the spy itself would recurse when its implementation calls acquisition.
	const acquire = vi.mocked(editor.openEditorBlob).getMockImplementation();
	if (!acquire)
		throw new Error("Missing real editor acquisition implementation");
	const acquired = Promise.withResolvers<Awaited<ReturnType<typeof acquire>>>();
	const delivery = Promise.withResolvers<void>();
	const open = vi
		.mocked(editor.openEditorBlob)
		.mockImplementation(async (...args) => {
			const session = await acquire(...args);
			acquired.resolve(session);
			await delivery.promise;
			return session;
		});
	const page = render(EditorApp, { processingLayer: SaveProcessingSync });
	let session: Awaited<ReturnType<typeof acquire>> | undefined;
	try {
		await fireEvent.change(page.getByLabelText("Save file"), {
			target: { files: [new File([fixtureXml], "LateSession")] },
		});
		session = await acquired.promise;
		expect(editorResources().models).toBe(1);
		page.unmount();
		delivery.resolve();
		await waitForIO(released);
		await expect(session.model.snapshot()).rejects.toThrow("closed");
	} finally {
		delivery.resolve();
		page.unmount();
		open.mockRestore();
		await session?.close();
	}
});

// Keep acquisition and resource counters in the same real module instance.
// A replaceable wrapper exposes its original implementation to the late-delivery
// test without re-importing a second instance with separate resource counters.
vi.mock("../../src/lib/editor/editor-model", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("../../src/lib/editor/editor-model")>();
	return {
		...original,
		openEditorBlob: vi.fn<typeof original.openEditorBlob>(
			original.openEditorBlob,
		),
	};
});

it("ignores Undo and Organize backpack clicks dispatched during Exit", async () => {
	// Observe the same registry the workspace borrows to detect queued work.
	const open = vi.mocked(editor.openEditorBlob);
	const acquire = open.getMockImplementation();
	if (!acquire)
		throw new Error("Missing real editor acquisition implementation");
	const mounted = Promise.withResolvers<Awaited<ReturnType<typeof acquire>>>();
	open.mockImplementationOnce(async (...args) => {
		const session = await acquire(...args);
		mounted.resolve(session);
		return session;
	});
	const page = render(EditorApp, { processingLayer: SaveProcessingSync });
	const errors: string[] = [];
	const onError = (event: ErrorEvent) => {
		event.preventDefault();
		errors.push(event.message);
	};
	window.addEventListener("error", onError);
	try {
		await fireEvent.change(page.getByLabelText("Save file"), {
			target: {
				files: [new File([fixtureXml], "ProbeFarm")],
			},
		});
		await fireEvent.click(
			await page.findByRole("link", { name: "Farm settings" }),
		);
		await fireEvent.input(
			await page.findByRole("textbox", { name: "Farm name" }),
			{
				target: { value: "Probe edit" },
			},
		);
		await fireEvent.click(page.getByRole("link", { name: "Inventory" }));
		const organize = await page.findByRole("button", {
			name: "Organize backpack",
		});
		const undo = page.getByRole("button", { name: "Undo" });
		await waitFor(() => expect(undo.hasAttribute("disabled")).toBe(false));
		const session = await mounted.promise;
		const { registry, pending } = session.model.atomBindings;
		await waitForIO(() => expect(registry.get(pending)).toBe(0));
		const exit = page.getByRole("button", { name: "Exit" });
		// Retain references and dispatch in one task, matching the trace's scripted caller.
		[exit, undo, organize].forEach((element) => element.click());
		// The registry remains live before tick, but neither click may queue work.
		expect(registry.get(pending)).toBe(0);
		await tick();
		await waitForIO(released);
		expect(errors).toEqual([]);
	} finally {
		window.removeEventListener("error", onError);
		page.unmount();
	}
});
