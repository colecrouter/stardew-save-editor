import { Effect, Layer, Result, Schema } from "effect";
import * as Transferable from "effect/workers/Transferable";
import { expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import {
	SaveProcessor,
	SaveExportFailed,
	importSave,
} from "../../src/lib/editor/save-processing.ts";
import { SaveCodec, SaveCodecLive } from "../../src/lib/editor/save-service.ts";
import {
	exportDocument,
	tinyEditorFixture,
} from "../helpers/editor-document.ts";

// Processing acquisition must live as long as the open file, not just openEditor's
// acquisition Effect. A premature close would return an already-dead RPC client.
it("keeps the export service alive until the file closes and preserves typed failures", async () => {
	const released = vi.fn();
	const failure = new SaveExportFailed({
		stage: "worker",
		message: "Worker unavailable",
	});
	const exporting = vi.fn(() => Effect.fail(failure));
	const codec = Effect.runSync(Effect.provide(SaveCodec, SaveCodecLive));
	const processingLayer = Layer.effect(SaveProcessor)(
		Effect.acquireRelease(
			Effect.succeed(
				SaveProcessor.of({
					import: (bytes) => importSave(codec, bytes),
					export: exporting,
				}),
			),
			() => Effect.sync(released),
		),
	);
	const opened = await openEditor(
		processingLayer,
		// Resource lifetime and typed failure propagation need a valid import,
		// not a populated world. Keep the real codec while bounding fixture work.
		new TextEncoder().encode(exportDocument(tinyEditorFixture())),
	);
	try {
		expect(released).not.toHaveBeenCalled();
		const result = await opened.model.commands.export();
		expect(result && Result.isFailure(result) && result.failure).toBe(failure);
		expect(exporting).toHaveBeenCalledOnce();
		expect(released).not.toHaveBeenCalled();
	} finally {
		await opened.close();
	}
	expect(released).toHaveBeenCalledOnce();
});

// Simulate the actual platform transfer, not just collector membership: the
// encoded view must stay a Uint8Array and its sender's buffer must be detached.
it("transfers encoded output bytes without JSON expansion or a buffer copy", async () => {
	const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 60, 47, 62]);
	const collector = Transferable.makeCollectorUnsafe();
	const encoded = await Effect.runPromise(
		Schema.encodeEffect(Schema.toCodecJson(Transferable.Uint8Array))(
			bytes,
		).pipe(Effect.provideService(Transferable.Collector, collector)),
	);
	const received = structuredClone(encoded, {
		transfer: collector.clearUnsafe(),
	});
	expect(bytes.byteLength).toBe(0);
	expect(received).toBeInstanceOf(Uint8Array);
	expect(
		Array.from(Schema.decodeUnknownSync(Transferable.Uint8Array)(received)),
	).toEqual([0xef, 0xbb, 0xbf, 60, 47, 62]);
});
