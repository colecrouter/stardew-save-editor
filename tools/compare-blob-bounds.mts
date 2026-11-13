import { readFileSync, writeFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import { Effect, Stream } from "effect";
import pako from "pako";
import { ValueSchema } from "../generated/save-format/save.ts";
import { decodeByteStream } from "../src/lib/save-format/index.ts";
import { saveBlobBytes } from "../src/lib/editor/save-blob-stream.ts";
import { SaveCodec, SaveCodecLive } from "../src/lib/editor/save-service.ts";

// Change only input subdivision; both modes use the same native Blob source,
// pako output size, byte XML decoder, typed interpreter and final validation.
const mode = process.argv[2];
if (mode !== "bounded" && mode !== "native")
	throw new Error("Use bounded or native");
const outputPath = process.argv[3];
if (!outputPath || outputPath.startsWith("--"))
	throw new Error("Provide an output JSON path");
const compressed = process.argv.includes("--compressed");
const raw = readFileSync(new URL("../tests/TestSave", import.meta.url));
const input = compressed ? pako.deflate(raw) : raw;
const blob = new Blob([input]);
let peakBufferedBytes = 0;
let maxXmlInputBytes = 0;
let xmlInputChunks = 0;
const stream = Stream.fromReadableStream({
	evaluate: () =>
		saveBlobBytes(blob, {
			maxInputBytes: mode === "native" ? Infinity : undefined,
			onBufferedBytes: (bytes) => {
				peakBufferedBytes = Math.max(peakBufferedBytes, bytes);
			},
		}),
	onError: (cause) => new Error("Input failure", { cause }),
}).pipe(
	Stream.map((chunk) => {
		xmlInputChunks++;
		maxXmlInputBytes = Math.max(maxXmlInputBytes, chunk.byteLength);
		return chunk;
	}),
);
const start = performance.now();
const saved = await Effect.runPromise(
	decodeByteStream("SaveGame", ValueSchema, stream),
);
const elapsedMs = performance.now() - start;
// Capture peak before allocating an independent reference document for parity.
const peakRssKiB = process.resourceUsage().maxRSS;
const codec = Effect.runSync(Effect.provide(SaveCodec, SaveCodecLive));
deepStrictEqual(saved, (await Effect.runPromise(codec.decode(input))).SaveGame);
const output = {
	mode,
	compressed,
	elapsedMs,
	peakRssKiB,
	peakBufferedBytes,
	maxXmlInputBytes,
	xmlInputChunks,
};
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output));
