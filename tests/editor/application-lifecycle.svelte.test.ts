import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import { tick } from "svelte";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import * as editor from "../../src/lib/editor/editor-model";
import { editorResources } from "../../src/lib/editor/editor-model";
import { fixtureXml } from "./fixtures";

const released = () =>
	expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });

// File reads cannot be interrupted by closing a component. Completing an old
// read must not create a session after its application owner has disappeared.
it("ignores a file read that finishes after application teardown", async () => {
	const pending = Promise.withResolvers<ArrayBuffer>();
	const file = new File([fixtureXml], "LateFarm");
	const read = vi.spyOn(file, "arrayBuffer").mockReturnValue(pending.promise);
	const open = vi.spyOn(editor, "openEditor");
	const backup = vi.fn(async () => {});
	const page = render(EditorApp, { backupOriginal: backup });
	try {
		await fireEvent.change(page.getByLabelText("Save file"), {
			target: { files: [file] },
		});
		await waitFor(() => expect(read).toHaveBeenCalledOnce());
		page.unmount();
		pending.resolve(new TextEncoder().encode(fixtureXml).buffer);
		await pending.promise;
		await tick();
		released();
		expect(backup).not.toHaveBeenCalled();
		expect(open).not.toHaveBeenCalled();
	} finally {
		page.unmount();
		pending.resolve(new ArrayBuffer(0));
		read.mockRestore();
		open.mockRestore();
		page.unmount();
	}
});

// Exit may happen while the browser owns a picker or is acquiring its stream.
// A late resolution must not write the abandoned session or affect its successor.
it.each(["picker", "stream"] as const)(
	"suppresses a late %s acquisition after Exit while the next save stays usable",
	{ timeout: 20000 },
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
		const page = render(EditorApp);
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "FirstFarm")] },
			});
			await waitFor(() =>
				expect(page.getByRole("button", { name: "Export save" })).toBeTruthy(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(() =>
				expect(
					stage === "stream" ? createWritable : picker,
				).toHaveBeenCalledOnce(),
			);
			await fireEvent.click(page.getByRole("button", { name: "Exit" }));
			await waitFor(released);
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "SecondFarm")] },
			});
			await waitFor(() =>
				expect(page.getByRole("button", { name: "Export save" })).toBeTruthy(),
			);
			acquisition.resolve();
			await acquisition.promise;
			await tick();
			if (stage === "stream")
				await waitFor(() => expect(abort).toHaveBeenCalledOnce());
			else expect(createWritable).not.toHaveBeenCalled();
			expect(write).not.toHaveBeenCalled();
			expect(close).not.toHaveBeenCalled();
			// The prior export's finally block must not disable the replacement's export.
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(() => expect(write).toHaveBeenCalledOnce());
			await waitFor(() => expect(close).toHaveBeenCalledOnce());
			expect(page.queryByRole("alert")).toBeNull();
		} finally {
			acquisition.resolve();
			page.unmount();
			Reflect.deleteProperty(window, "showSaveFilePicker");
			await waitFor(released);
		}
	},
);

// Acquisition may already have succeeded when teardown invalidates its delivery.
// The generation guard must close that real session instead of installing it.
it(
	"closes an acquired session delivered after application teardown",
	{ timeout: 15000 },
	async () => {
		const acquire = editor.openEditor;
		const acquired =
			Promise.withResolvers<Awaited<ReturnType<typeof acquire>>>();
		const delivery = Promise.withResolvers<void>();
		const open = vi
			.spyOn(editor, "openEditor")
			.mockImplementation(async (...args) => {
				const session = await acquire(...args);
				acquired.resolve(session);
				await delivery.promise;
				return session;
			});
		const page = render(EditorApp);
		let session: Awaited<ReturnType<typeof acquire>> | undefined;
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "LateSession")] },
			});
			session = await acquired.promise;
			expect(editorResources().models).toBe(1);
			page.unmount();
			delivery.resolve();
			await waitFor(released);
			await expect(session.model.snapshot()).rejects.toThrow("closed");
		} finally {
			delivery.resolve();
			page.unmount();
			open.mockRestore();
			await session?.close();
		}
	},
);
