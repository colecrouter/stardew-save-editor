import { readFile } from "node:fs/promises";
import { Effect, Fiber, Stream } from "effect";
import { expect, it } from "vitest";
import pako from "pako";
import {
	decodeByteStream,
	decodeChunks,
	scalar,
} from "../../src/lib/save-format/index.ts";
import { SaveCodec, SaveCodecLive } from "../../src/lib/editor/save-service.ts";
import { saveBlobBytes } from "../../src/lib/editor/save-blob-stream.ts";
import { openEditorBlob } from "../../src/lib/editor/editor-model.ts";
import { SaveProcessingNode } from "../helpers/save-processing-node.ts";

const codec = Effect.runSync(Effect.provide(SaveCodec, SaveCodecLive));
const decode = codec.decodeBlob!;

it("streams public XML and compressed saves with byte-path parity and real worker transport", async () => {
	const bytes = new Uint8Array(
		await readFile(new URL("../TestSave", import.meta.url)),
	);
	const original = await Effect.runPromise(codec.decode(bytes));
	expect(await Effect.runPromise(decode(new Blob([bytes])))).toEqual(original);
	expect(
		await Effect.runPromise(decode(new Blob([pako.deflate(bytes)]))),
	).toEqual(original);
	// Blob crosses the production RPC schema; opening its stream happens in the
	// worker, not in the caller. The caller's original remains available for backup.
	class StreamingOnlyBlob extends Blob {
		override arrayBuffer(): Promise<ArrayBuffer> {
			throw new Error("Main thread materialized the file");
		}
	}
	const blob = new StreamingOnlyBlob([bytes]);
	const opened = await openEditorBlob(SaveProcessingNode, blob);
	try {
		expect((await opened.model.snapshot()).document).toEqual(original);
	} finally {
		await opened.close();
	}
	expect(blob.size).toBe(bytes.length);
}, 120_000);

it("rejects truncated zlib and malformed XML through typed failures", async () => {
	const compressed = pako.deflate(new TextEncoder().encode("<SaveGame />"));
	const broken = compressed.subarray(0, compressed.length - 3);
	const error = await Effect.runPromise(
		decode(new Blob([broken])).pipe(Effect.flip),
	);
	expect(error.stage).toBe("decompress");
	const xmlError = await Effect.runPromise(
		decode(new Blob(["<SaveGame><broken></SaveGame>"])).pipe(Effect.flip),
	);
	expect(xmlError.stage).toBe("xml");
});

it("cancels a pending upstream read when the import fiber is interrupted", async () => {
	let cancelled = false;
	let markStarted = () => {};
	const started = new Promise<void>((resolve) => {
		markStarted = () => resolve();
	});
	const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
		pull() {
			markStarted();
		},
		cancel() {
			cancelled = true;
		},
	});
	class WaitingBlob extends Blob {
		override stream() {
			return source;
		}
	}
	const fiber = Effect.runFork(decode(new WaitingBlob()));
	// Wait for a pending read explicitly; cancellation must not depend on timing.
	await started;
	await Effect.runPromise(Fiber.interrupt(fiber));
	expect(cancelled).toBe(true);
});

it("passes split UTF-8 bytes through the XML byte decoder", async () => {
	// Read the transport helper incrementally, including a first empty chunk. The
	// helper must not sniff an empty buffer or concatenate all input before yielding.
	const expected = new TextEncoder().encode("<x>🌱</x>");
	let cursor = 0;
	class SplitBlob extends Blob {
		override stream() {
			return new ReadableStream<Uint8Array<ArrayBuffer>>({
				pull(controller) {
					if (cursor === 0) {
						cursor++;
						controller.enqueue(new Uint8Array());
					} else if (cursor <= expected.length)
						controller.enqueue(expected.subarray(cursor++ - 1, cursor - 1));
					else controller.close();
				},
			});
		}
	}
	const reader = saveBlobBytes(new SplitBlob()).getReader();
	const chunks: number[] = [];
	for (;;) {
		const read = await reader.read();
		if (read.done) break;
		chunks.push(...read.value);
	}
	expect(chunks).toEqual([...expected]);
	const value = await Effect.runPromise(
		decodeByteStream(
			"x",
			scalar("System.String"),
			Stream.fromIterable(
				Array.from(expected, (byte) => new Uint8Array([byte])),
				{ chunkSize: 1 },
			),
		),
	);
	expect(value).toBe("🌱");
});

// Extracting the common interpreter must retain Effect's lazy, reusable behavior.
it("can evaluate the same text decoding Effect more than once", async () => {
	const reading = decodeChunks("x", scalar("System.String"), ["<x>saved</x>"]);
	expect(await Effect.runPromise(reading)).toBe("saved");
	expect(await Effect.runPromise(reading)).toBe("saved");
});
