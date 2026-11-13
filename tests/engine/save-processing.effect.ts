import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { SaveProcessor } from "../../src/lib/editor/save-processing.ts";
import { parser } from "../helpers/editor-document.ts";
import { SaveProcessingNode } from "../helpers/save-processing-node.ts";

const input = () => readFile(new URL("../TestSave", import.meta.url));

// Exercise the real Node adapter and production handlers, not a worker shim or
// an alternate test codec. The caller's input bytes remain owned by the caller.
// These full-save roundtrips include worker startup and the generated XML codec,
// so both scenarios use an integration budget rather than the unit-test timeout.
it(
	"Node worker processing preserves the full save and caller-owned bytes",
	{ timeout: 60_000 },
	async () => {
		const bytes = await input();
		const originalLength = bytes.byteLength;
		const originalHash = createHash("sha256").update(bytes).digest("hex");
		const opened = await openEditor(SaveProcessingNode, bytes);
		try {
			const result = await opened.model.commands.export();
			if (!result || Result.isFailure(result))
				throw new Error("Export did not complete");
			// Compare semantic saved values, including bigint IDs, rather than the
			// lexical XML spellings intentionally canonicalized by the new codec.
			expect(parser.parse(new TextDecoder().decode(result.success))).toEqual(
				parser.parse(new TextDecoder().decode(bytes)),
			);
			// Hash the full input instead of asking the assertion engine to expand
			// millions of individual byte indices; detachment also changes its length.
			expect(bytes.byteLength).toBe(originalLength);
			expect(createHash("sha256").update(bytes).digest("hex")).toBe(
				originalHash,
			);
			expect(result.success.buffer).toBeInstanceOf(ArrayBuffer);
		} finally {
			await opened.close();
		}
	},
);

// Expected decode errors must cross RPC without killing the worker. A subsequent
// compressed import and export in the same scope must still preserve mod fields.
it.effect(
	"Node worker survives malformed input and processes compressed saves",
	() =>
		Effect.gen(function* () {
			const processor = yield* SaveProcessor;
			const rejected = yield* Effect.result(
				processor.import(new TextEncoder().encode("<SaveGame>")),
			);
			expect(Result.isFailure(rejected) && rejected.failure.stage).toBe("xml");
			const bytes = yield* Effect.promise(input);
			const imported = yield* processor.import(deflateSync(bytes));
			Object.assign(imported.document.SaveGame, {
				customModField: { opaque: "007", nested: { flag: "text" } },
			});
			const exported = yield* processor.export(imported.document, true);
			expect((yield* processor.import(exported)).document).toEqual(
				imported.document,
			);
		}).pipe(Effect.provide(SaveProcessingNode)),
	60_000,
);
