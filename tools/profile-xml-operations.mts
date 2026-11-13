import { readFileSync, writeFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import { Session } from "node:inspector/promises";
import { Effect, Schema, Stream } from "effect";
import { saveBlobBytes } from "../src/lib/editor/save-blob-stream.ts";
import { decodeByteStream } from "../src/lib/save-format/index.ts";

import { ValueSchema, XmlSchema } from "../generated/save-format/save.ts";

// Run directly with Node 24 to preserve source locations in inspector profiles.
const xml = readFileSync(new URL("../tests/TestSave", import.meta.url), "utf8");
const blob = new Blob([xml]);
const decode = () =>
	Effect.runPromise(
		decodeByteStream(
			"SaveGame",
			ValueSchema,
			Stream.fromReadableStream({
				evaluate: () => saveBlobBytes(blob),
				onError: (cause) => new Error("Input failure", { cause }),
			}),
		),
	);
const outputPath = process.argv[2];
if (!outputPath || outputPath.startsWith("--"))
	throw new Error("Provide an output JSON path");
const profiling = process.argv.includes("--profile");
const session = new Session();
if (profiling) {
	// Warm the decoder before sampling; this diagnostic run is not a timing sample.
	await decode();
	session.connect();
	await session.post("Profiler.enable");
	await session.post("Profiler.start");
}
const start = performance.now();
const saved = await decode();
const decodeMs = performance.now() - start;
const peakRssKiB = process.resourceUsage().maxRSS;
let hotFunctions: unknown;
if (profiling) {
	const { profile } = await session.post("Profiler.stop");
	session.disconnect();
	writeFileSync(`${outputPath}.cpuprofile`, JSON.stringify(profile));
	const hits = new Map<number, number>();
	for (const id of profile.samples ?? []) hits.set(id, (hits.get(id) ?? 0) + 1);
	hotFunctions = profile.nodes
		.map((node) => ({
			name: node.callFrame.functionName,
			file: node.callFrame.url,
			line: node.callFrame.lineNumber + 1,
			samples: hits.get(node.id) ?? 0,
		}))
		.filter((node) => node.samples > 0)
		.sort((a, b) => b.samples - a.samples)
		.slice(0, 35);
}
const encodeStart = performance.now();
const exported = await Effect.runPromise(Schema.encodeEffect(XmlSchema)(saved));
const encodeMs = performance.now() - encodeStart;
// Check both import and emitted XML independently after collecting measurements.
deepStrictEqual(saved, Schema.decodeSync(XmlSchema)(xml));
deepStrictEqual(saved, Schema.decodeSync(XmlSchema)(exported));
const output = {
	node: process.version,
	decodeMs,
	encodeMs,
	peakRssKiB,
	hotFunctions,
};
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output));
