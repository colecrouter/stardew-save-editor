import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { Effect, Result, Schema, Stream } from "effect";
import pako from "pako";
import { Xml } from "effect/encoding";
import { XmlSchema } from "../generated/save-format/save.ts";
import { XMLCodec } from "../src/lib/xmlCodec.ts";
import { SaveCodec, SaveCodecLive } from "../src/lib/editor/save-service.ts";
import { openEditor } from "../src/lib/editor/editor-model.ts";
import { SaveProcessingSync } from "../src/lib/editor/save-processing.ts";

// Keep the workload public and immutable; never discover local player files.
const original = readFileSync(
	new URL("../tests/TestSave", import.meta.url),
	"utf8",
);
const samples = Number(process.env.PROFILE_SAMPLES ?? 3);
// Reject empty or invalid sampling requests rather than recording misleading data.
if (!Number.isInteger(samples) || samples < 3)
	throw new Error("Use at least three samples");
const legacy = new XMLCodec();
const codec = Effect.runSync(Effect.provide(SaveCodec, SaveCodecLive));
async function measure(name: string, work: () => unknown) {
	console.error(name);
	await work();
	const times: number[] = [];
	for (let index = 0; index < samples; index++) {
		const start = performance.now();
		await work();
		times.push(performance.now() - start);
	}
	times.sort((a, b) => a - b);
	return {
		medianMs: times[Math.floor(samples / 2)],
		minMs: times[0],
		maxMs: times.at(-1),
	};
}
const results: Record<string, unknown> = {};
for (const [name, xml] of [["public", original]] as const) {
	const bytes = new TextEncoder().encode(xml);
	const compressed = pako.deflate(bytes);
	const document = await Effect.runPromise(codec.decode(bytes));
	const old = legacy.parse(xml);
	const stages: Record<string, unknown> = {};
	const probes: Record<string, () => unknown> = {
		utf8: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
		inflate: () => pako.inflate(compressed),
		effectXmlScan: () =>
			Effect.runPromise(
				Stream.make(xml).pipe(
					Stream.pipeThroughChannel(Xml.decodeString()),
					Stream.runDrain,
				),
			),
		typedDecode: () => Effect.runPromise(codec.decode(bytes)),
		typedValueValidation: () =>
			Effect.runPromise(
				Schema.decodeEffect(Schema.toType(XmlSchema))(document.SaveGame),
			),
		typedEncode: () => Effect.runPromise(codec.encode(document)),
		structuredClone: () => structuredClone(document),
		legacyParse: () => legacy.parse(xml),
		legacyBuild: () => legacy.stringify(structuredClone(old)),
	};
	for (const [stage, probe] of Object.entries(probes))
		stages[stage] = await measure(`${name} ${stage}`, probe);
	let opened: Awaited<ReturnType<typeof openEditor>> | undefined;
	stages.currentOpen = await measure(`${name} open`, async () => {
		await opened?.close();
		opened = await openEditor(SaveProcessingSync, bytes);
	});
	if (!opened) throw new Error("No editor acquired");
	const model = opened.model;
	stages.currentExport = await measure(`${name} export`, async () => {
		const result = await model.commands.export();
		if (!result || Result.isFailure(result))
			throw new Error("The benchmark export did not succeed");
		return result.success;
	});
	await opened.close();
	results[name] = {
		xmlBytes: bytes.byteLength,
		compressedBytes: compressed.byteLength,
		stages,
	};
}
// Hash the relevant production sources so timings can be tied to the exact
// implementation even while this branch is still being prepared for review.
const sourcePaths = [
	"src/lib/save-format/xml.ts",
	"src/lib/save-format/events.ts",
	"src/lib/save-format/values.ts",
	"src/lib/save-format/objects.ts",
	"src/lib/xmlCodec.ts",
	"src/lib/xmlObject.ts",
	"src/lib/editor/save-service.ts",
	"src/lib/editor/save-processing.ts",
	"src/lib/editor/editor-model.ts",
	"generated/save-format/save.ts",
];
const output = {
	fixtureSha256: createHash("sha256").update(original).digest("hex"),
	sourceSha256: Object.fromEntries(
		sourcePaths
			.filter((path) => existsSync(new URL(`../${path}`, import.meta.url)))
			.map((path) => [
				path,
				createHash("sha256")
					.update(readFileSync(new URL(`../${path}`, import.meta.url)))
					.digest("hex"),
			]),
	),
	node: process.version,
	cpu: cpus()[0]?.model,
	samples,
	results,
};
writeFileSync(
	process.argv[2] ?? "/tmp/current-save-pipeline.json",
	JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output, null, 2));
