import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { Effect, Layer } from "effect";
import { expect, it, vi } from "vitest";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import {
	SaveProcessor,
	makeSaveProcessor,
	type ImportedSave,
} from "../../src/lib/editor/save-processing.ts";
import {
	SaveReadError,
	SaveCodec,
	SaveCodecLive,
} from "../../src/lib/editor/save-service.ts";
import { editorResources } from "../../src/lib/editor/editor-model.ts";
import { fixtureXml, parser } from "./fixtures.ts";
import {
	exportDocument,
	tinyEditorFixture,
} from "../helpers/editor-document.ts";

// Cancellation can happen while the processing layer itself is still being
// acquired, before import() exists. Release acquired resources and permit retry.
it(
	"cancels processing-layer acquisition and opens a fresh session on retry",
	{ timeout: 15000 },
	async () => {
		let attempts = 0;
		const released = vi.fn();
		const acquiring = vi.fn();
		const processingLayer = Layer.effect(SaveProcessor)(
			Effect.gen(function* () {
				const attempt = yield* Effect.acquireRelease(
					Effect.sync(() => {
						acquiring();
						return ++attempts;
					}),
					() => Effect.sync(released),
				);
				if (attempt === 1) return yield* Effect.never;
				return makeSaveProcessor(yield* SaveCodec);
			}),
		).pipe(Layer.provide(SaveCodecLive));
		const page = render(EditorApp, { processingLayer });
		try {
			const input = page.getByLabelText("Save file") as HTMLInputElement;
			// Layer acquisition/retry owns a real codec, but needs no populated world.
			const file = new File([exportDocument(tinyEditorFixture())], "Farm_123");
			await fireEvent.change(input, { target: { files: [file] } });
			await waitFor(() => expect(acquiring).toHaveBeenCalledOnce());
			expect(page.getByText("Opening save…")).toBeTruthy();
			expect(input.disabled).toBe(true);
			await fireEvent.click(
				page.getByRole("button", { name: "Cancel import" }),
			);
			await waitFor(() => expect(released).toHaveBeenCalledOnce());
			expect(input.disabled).toBe(false);
			expect(page.queryByRole("alert")).toBeNull();
			await fireEvent.change(input, { target: { files: [file] } });
			await page.findByRole("button", { name: "Export save" });
			expect(acquiring).toHaveBeenCalledTimes(2);
			expect(released).toHaveBeenCalledOnce();
		} finally {
			page.unmount();
			await waitFor(() => expect(released).toHaveBeenCalledTimes(attempts));
		}
	},
);

// The worker belongs to the pending import, before an editor exists. Cancel must
// release that scope immediately, without waiting for an uncancelable promise.
it("announces reading and processing, disables duplicate imports and cancels pending work", async () => {
	const read = Promise.withResolvers<ArrayBuffer>();
	const decoded = Promise.withResolvers<ImportedSave>();
	const importing = vi.fn(() => Effect.promise(() => decoded.promise));
	const released = vi.fn();
	const processingLayer = Layer.effect(SaveProcessor)(
		Effect.acquireRelease(
			Effect.succeed(
				SaveProcessor.of({ import: importing, export: () => Effect.never }),
			),
			() => Effect.sync(released),
		),
	);
	const file = new File([fixtureXml], "Farm_123");
	vi.spyOn(file, "arrayBuffer").mockReturnValue(read.promise);
	const page = render(EditorApp, { processingLayer });
	try {
		const input = page.getByLabelText("Save file") as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [file] } });
		expect(page.getByText("Reading save…")).toBeTruthy();
		expect(input.disabled).toBe(true);
		expect(
			page.container.querySelector(".file-picker")?.getAttribute("aria-busy"),
		).toBe("true");
		read.resolve(new TextEncoder().encode(fixtureXml).buffer);
		await waitFor(() => expect(importing).toHaveBeenCalledOnce());
		expect(page.getByText("Opening save…")).toBeTruthy();
		await fireEvent.click(page.getByRole("button", { name: "Cancel import" }));
		await waitFor(() => expect(released).toHaveBeenCalledOnce());
		expect(input.disabled).toBe(false);
		expect(page.queryByText("Opening save…")).toBeNull();
		// A delayed transport response cannot revive the canceled file.
		decoded.resolve({
			document: parser.parse(fixtureXml),
			validation: { valid: true, errors: [], warnings: [] },
		});
		await decoded.promise;
		expect(page.queryByRole("button", { name: "Export save" })).toBeNull();
		expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });
	} finally {
		page.unmount();
		read.resolve(new ArrayBuffer(0));
		decoded.resolve({
			document: parser.parse(fixtureXml),
			validation: { valid: true, errors: [], warnings: [] },
		});
	}
});

it("clears busy feedback and releases the worker after a typed import failure", async () => {
	const released = vi.fn();
	const processingLayer = Layer.effect(SaveProcessor)(
		Effect.acquireRelease(
			Effect.succeed(
				SaveProcessor.of({
					import: () =>
						Effect.fail(new SaveReadError({ stage: "xml", cause: undefined })),
					export: () => Effect.never,
				}),
			),
			() => Effect.sync(released),
		),
	);
	const page = render(EditorApp, { processingLayer });
	try {
		const input = page.getByLabelText("Save file") as HTMLInputElement;
		await fireEvent.change(input, {
			target: { files: [new File(["broken"], "Farm_123")] },
		});
		await page.findByText(
			/This file could not be read as a Stardew Valley save/,
		);
		expect(input.disabled).toBe(false);
		expect(
			page.container.querySelector(".file-picker")?.getAttribute("aria-busy"),
		).toBe("false");
		expect(released).toHaveBeenCalledOnce();
		expect(page.queryByText("Opening save…")).toBeNull();
	} finally {
		page.unmount();
	}
});
