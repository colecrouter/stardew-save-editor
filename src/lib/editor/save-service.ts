import { Context, Data, Effect, Layer, Schema } from "effect";
import { XmlSchema } from "../../../generated/save-format/save.ts";
import pako from "pako";
import type { EditorGame, SaveDocument } from "./domain.ts";

export class SaveReadError extends Data.TaggedError("SaveReadError")<{
	stage: "decompress" | "xml" | "shape" | "version" | "worker";
	cause: unknown;
}> {}
// Import errors describe the recovery action without printing parser internals or
// uploaded data. Unsupported inputs remain retryable in the same file picker.
export function describeImportError(error: SaveReadError): string {
	switch (error.stage) {
		case "worker":
			return "The save could not be processed. Please try opening it again.";
		case "version":
			return "This editor supports Stardew Valley 1.6 saves.";
		case "shape":
			return "Choose the main farm save file, not SaveGameInfo. This file is missing required save data.";
		case "xml":
			return "This file could not be read as a Stardew Valley save. Choose another file.";
		case "decompress":
			return "This file is incomplete or could not be decompressed. Choose another copy of your save.";
	}
}

export class SaveWriteError extends Data.TaggedError("SaveWriteError")<{
	cause: unknown;
}> {}

// Check the minimum editor envelope after full typed XML decoding. Keep the
// complete decoded object, including unknown fields, rather than this projection.
const envelope = Schema.Struct({
	player: Schema.Struct({
		name: Schema.String,
		farmName: Schema.String,
		money: Schema.Finite,
		UniqueMultiplayerID: Schema.BigInt,
		items: Schema.Array(Schema.Unknown),
	}),
	farmhands: Schema.Array(Schema.Unknown),
});

export class SaveCodec extends Context.Service<
	SaveCodec,
	{
		decode: (bytes: Uint8Array) => Effect.Effect<SaveDocument, SaveReadError>;
		encode: (
			document: SaveDocument,
		) => Effect.Effect<Uint8Array<ArrayBuffer>, SaveWriteError>;
	}
>()("editor/SaveCodec") {}

export const SaveCodecLive = Layer.sync(SaveCodec, () => {
	return {
		decode: (bytes) =>
			Effect.gen(function* () {
				const xml = yield* Effect.try({
					try: () => {
						const inflated = bytes[0] === 120 ? pako.inflate(bytes) : bytes;
						if (!(inflated instanceof Uint8Array))
							throw new Error("Incomplete zlib stream");
						return new TextDecoder("utf-8", { fatal: true }).decode(inflated);
					},
					catch: (cause) => new SaveReadError({ stage: "decompress", cause }),
				});
				const saved = yield* Schema.decodeEffect(XmlSchema)(xml).pipe(
					Effect.mapError(
						(cause) => new SaveReadError({ stage: "xml", cause }),
					),
				);
				yield* Schema.decodeUnknownEffect(envelope)(saved).pipe(
					Effect.mapError(
						(cause) => new SaveReadError({ stage: "shape", cause }),
					),
				);
				// The envelope establishes the required editor fields without narrowing away
				// any other generated or unknown saved fields.
				const document = { SaveGame: saved as EditorGame };
				const version = saved.gameVersion ?? "";
				if (!/^1\.6(?:\.|$)/.test(version))
					return yield* new SaveReadError({ stage: "version", cause: version });
				return document;
			}),
		encode: (document) =>
			Schema.encodeEffect(XmlSchema)(document.SaveGame).pipe(
				Effect.mapError((cause) => new SaveWriteError({ cause })),
				Effect.map((xml) => {
					// Keep the established UTF-8 BOM and transferable byte-array boundary.
					const encoded = new TextEncoder().encode(xml);
					const bytes = new Uint8Array(encoded.length + 3);
					bytes.set([0xef, 0xbb, 0xbf]);
					bytes.set(encoded, 3);
					return bytes;
				}),
			),
	};
});
