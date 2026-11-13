import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";
import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import { tick } from "svelte";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import * as editor from "../../src/lib/editor/editor-model";
import { editorResources } from "../../src/lib/editor/editor-model";
import {
	exportDocument,
	tinyEditorFixture,
} from "../helpers/editor-document.ts";

// These races require real sessions and export I/O, but no populated farm.
const fixtureXml = exportDocument(tinyEditorFixture());

// These assertions wait on full-save import/export as well as browser promises.
const waitForIO = <T>(assertion: () => T) =>
	waitFor(assertion, { timeout: 30_000 });

const released = () =>
	expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });

// Teardown must cancel a pending stream read before any session is installed.
// A producer that finishes late cannot revive the abandoned import or back it up.
it("ignores a stream read that finishes after application teardown", async () => {
	const pending = Promise.withResolvers<void>();
	const file = new File([fixtureXml], "LateFarm");
	let cancelled = false;
	const cancel = vi.fn(() => {
		cancelled = true;
	});
	const read = vi.fn(
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
	const backup = vi.fn(async () => {});
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
	{ timeout: 60_000 },
	async (stage) => {
		const acquisition = Promise.withResolvers<void>();
		const write = vi.fn(async () => {}),
			close = vi.fn(async () => {}),
			abort = vi.fn(async () => {});
		const writable = { write, close, abort };
		const createWritable = vi.fn(async () => {
			if (stage === "stream") await acquisition.promise;
			return writable;
		});
		const picker = vi.fn(async () => {
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
			if (stage === "stream")
				await waitForIO(() => expect(abort).toHaveBeenCalledOnce());
			else expect(createWritable).not.toHaveBeenCalled();
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
it(
	"closes an acquired session delivered after application teardown",
	{ timeout: 60_000 },
	async () => {
		const acquire = editor.openEditorBlob;
		const acquired =
			Promise.withResolvers<Awaited<ReturnType<typeof acquire>>>();
		const delivery = Promise.withResolvers<void>();
		const open = vi
			.spyOn(editor, "openEditorBlob")
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
	},
);
