import { Context, Data, Effect, Layer, Schema } from "effect";
import { XMLValidator } from "fast-xml-parser";
import pako from "pako";
import { XMLCodec } from "../../src/lib/xmlCodec.ts";
import type { SaveDocument } from "./domain.ts";

export class SaveReadError extends Data.TaggedError("SaveReadError")<{
	stage: "decompress" | "xml" | "shape" | "version";
	cause: unknown;
}> {}
export class SaveWriteError extends Data.TaggedError("SaveWriteError")<{
	cause: unknown;
}> {}

// Validate a minimum envelope, not every game/mod field. Ignore the decoded
// projection: authoritative data stays the complete codec result, unknowns intact.
const envelope = Schema.Struct({
	SaveGame: Schema.Struct({
		gameVersion: Schema.String,
		player: Schema.Struct({
			name: Schema.String,
			UniqueMultiplayerID: Schema.Union([Schema.String, Schema.Finite]),
			items: Schema.Struct({ Item: Schema.Array(Schema.Unknown) }),
		}),
		farmhands: Schema.Union([
			Schema.Literal(""),
			Schema.Struct({ Farmer: Schema.Array(Schema.Unknown) }),
		]),
	}),
});

export class SaveCodec extends Context.Service<
	SaveCodec,
	{
		decode: (bytes: Uint8Array) => Effect.Effect<SaveDocument, SaveReadError>;
		encode: (
			document: SaveDocument,
		) => Effect.Effect<Uint8Array, SaveWriteError>;
	}
>()("experiment/SaveCodec") {}

export const SaveCodecLive = Layer.sync(SaveCodec, () => {
	const codec = new XMLCodec();
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
				const document = yield* Effect.try({
					try: () => {
						const checked = XMLValidator.validate(xml);
						if (checked !== true) throw checked;
						return codec.parse<SaveDocument>(xml);
					},
					catch: (cause) => new SaveReadError({ stage: "xml", cause }),
				});
				yield* Schema.decodeUnknownEffect(envelope)(document).pipe(
					Effect.mapError(
						(cause) => new SaveReadError({ stage: "shape", cause }),
					),
				);
				const version = (
					document.SaveGame as unknown as { gameVersion: string }
				).gameVersion;
				if (!/^1\.6(?:\.|$)/.test(version))
					return yield* new SaveReadError({ stage: "version", cause: version });
				return document;
			}),
		encode: (document) =>
			Effect.try({
				try: () => codec.stringify(structuredClone(document)),
				catch: (cause) => new SaveWriteError({ cause }),
			}),
	};
});
