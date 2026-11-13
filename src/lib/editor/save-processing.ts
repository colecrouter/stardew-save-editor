import { Context, Effect, Layer, Schema } from "effect";
import { describeProblems, validateSave } from "../saveValidation.ts";
import type { SaveDocument } from "./domain.ts";
import {
	SaveCodec,
	SaveCodecLive,
	type SaveReadError,
} from "./save-service.ts";

// Expected failures cross the worker boundary as schemas, without parser causes
// that could include private save content. Validation retains actionable details.
export class SaveExportRejected extends Schema.TaggedError<
	SaveExportRejected,
	{ readonly brand: unique symbol }
>()("SaveExportRejected", {
	message: Schema.String,
	validation: Schema.Struct({
		valid: Schema.Boolean,
		errors: Schema.mutable(Schema.Array(Schema.String)),
		warnings: Schema.mutable(Schema.Array(Schema.String)),
	}),
}) {}

export class SaveExportFailed extends Schema.TaggedError<
	SaveExportFailed,
	{ readonly brand: unique symbol }
>()("SaveExportFailed", {
	stage: Schema.Literals(["encode", "readback", "worker"]),
	message: Schema.String,
}) {}

export class SaveProcessor extends Context.Service<
	SaveProcessor,
	{
		readonly import: (
			bytes: Uint8Array,
		) => Effect.Effect<ImportedSave, SaveReadError>;
		readonly importBlob?: (
			blob: Blob,
		) => Effect.Effect<ImportedSave, SaveReadError>;
		readonly export: (
			document: SaveDocument,
			validate: boolean,
		) => Effect.Effect<
			Uint8Array<ArrayBuffer>,
			SaveExportRejected | SaveExportFailed
		>;
	}
>()("editor/SaveProcessor") {}

export interface ImportedSave {
	document: SaveDocument;
	validation: ReturnType<typeof validateSave>;
}

// Decode and inspect the original in the same execution context. The browser
// worker returns complete saved data plus warnings, never a schema projection.
export const importSave = (codec: SaveCodec["Service"], bytes: Uint8Array) =>
	Effect.map(codec.decode(bytes), (document): ImportedSave => ({
		document,
		validation: validateSave(document),
	}));

// Both the browser worker and synchronous tools use this exact round trip.
// Validate the bytes that will be written, preserving all unknown/modded fields.
export const exportSave = (
	codec: SaveCodec["Service"],
	document: SaveDocument,
	validate: boolean,
) =>
	Effect.gen(function* () {
		const bytes = yield* codec.encode(document).pipe(
			Effect.mapError(
				() =>
					new SaveExportFailed({
						stage: "encode",
						message:
							"The save could not be prepared for download. Please try again.",
					}),
			),
		);
		const reparsed = yield* codec.decode(bytes).pipe(
			Effect.mapError(
				() =>
					new SaveExportFailed({
						stage: "readback",
						message:
							"The exported save could not be read back. No file was written.",
					}),
			),
		);
		const validation = validateSave(reparsed);
		if (validate && !validation.valid)
			return yield* new SaveExportRejected({
				message: `Save file not downloaded: ${describeProblems(validation.errors)}`,
				validation,
			});
		return bytes;
	});

// Direct model fixtures can supply their codec explicitly. The application
// composition root provides the same implementation as a named service layer.
export const makeSaveProcessor = (
	codec: SaveCodec["Service"],
): SaveProcessor["Service"] => {
	const decodeBlob = codec.decodeBlob;
	return SaveProcessor.of({
		import: (bytes) => importSave(codec, bytes),
		// Optional on injected test codecs; production always offers the streaming reader.
		...(decodeBlob
			? {
					importBlob: (blob: Blob) =>
						Effect.map(decodeBlob(blob), (document): ImportedSave => ({
							document,
							validation: validateSave(document),
						})),
				}
			: {}),
		export: (document, validate) => exportSave(codec, document, validate),
	});
};

// Unit tests and CPU-only profiling opt into synchronous processing explicitly.
// Application and worker integration callers supply their platform's worker layer.
export const SaveProcessingSync = Layer.effect(SaveProcessor)(
	Effect.map(SaveCodec, makeSaveProcessor),
).pipe(Layer.provide(SaveCodecLive));
