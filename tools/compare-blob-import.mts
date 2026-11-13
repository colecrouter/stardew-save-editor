import { readFileSync, writeFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import { Effect } from "effect";
import pako from "pako";
import { SaveCodec, SaveCodecLive } from "../src/lib/editor/save-service.ts";
import { openEditor, openEditorBlob } from "../src/lib/editor/editor-model.ts";
import { SaveProcessingNode } from "../tests/helpers/save-processing-node.ts";

// Run each input mode in its own process. Both paths include real worker RPC,
// decoding and model acquisition; only the input representation differs.
const mode = process.argv[2] ?? "bytes";
if (mode !== "bytes" && mode !== "blob") throw new Error("Use bytes or blob");
const compressed = process.argv.includes("--compressed");
const single = process.argv.includes("--single");
const bytes = readFileSync(new URL("../tests/TestSave", import.meta.url));
const input = compressed ? pako.deflate(bytes) : bytes;
const blob = new Blob([input]);
const samples: number[] = [];
let opened: Awaited<ReturnType<typeof openEditor>> | undefined;
for (let index = 0; index < (single ? 1 : 4); index++) {
	await opened?.close();
	const start = performance.now();
	opened =
		mode === "blob"
			? await openEditorBlob(SaveProcessingNode, blob)
			: await openEditor(
					SaveProcessingNode,
					new Uint8Array(await blob.arrayBuffer()),
				);
	if (single || index) samples.push(performance.now() - start);
}
if (!opened) throw new Error("No imported model");
// Peak RSS covers the worker and main process, before the separate parity check
// creates another decoded document. RSS includes VM/GC overhead, not just file bytes.
const resources = process.resourceUsage();
const output = {
	mode,
	compressed,
	single,
	inputBytes: input.length,
	samples,
	medianMs: samples.toSorted((a, b) => a - b)[Math.floor(samples.length / 2)],
	peakRssKiB: resources.maxRSS,
	node: process.version,
};
const imported = (await opened.model.snapshot()).document;
await opened.close();
const codec = Effect.runSync(Effect.provide(SaveCodec, SaveCodecLive));
deepStrictEqual(imported, await Effect.runPromise(codec.decode(input)));
writeFileSync(
	(process.argv[3]?.startsWith("--") ? undefined : process.argv[3]) ??
		`/tmp/blob-import-${mode}-${compressed}.json`,
	JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output));
