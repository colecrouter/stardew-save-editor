import { Effect, Schema } from "effect";
import { expect, it } from "vitest";

import { ValueSchema, XmlSchema } from "../../generated/save-format/save.ts";
import { SaveCodec, SaveCodecLive } from "../../src/lib/editor/save-service.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";

it.each(["text", "1.5", "NaN", "2147483648"])(
	"rejects invalid Int32 progress evidence at import: %s",
	async (value) => {
		const document = tinyEditorFixture();
		document.SaveGame.player.farmingLevel = 0;
		// Corrupt serialized input before import, rather than passing an invalid
		// in-memory number to a projection that consumes decoded SaveDocuments.
		const xml = Schema.encodeSync(XmlSchema)(document.SaveGame).replace(
			"<farmingLevel>0</farmingLevel>",
			`<farmingLevel>${value}</farmingLevel>`,
		);
		const error = await Effect.runPromise(
			Effect.gen(function* () {
				const codec = yield* SaveCodec;
				return yield* codec
					.decode(new TextEncoder().encode(xml))
					.pipe(Effect.flip);
			}).pipe(Effect.provide(SaveCodecLive)),
		);
		expect(error.stage).toBe("xml");
	},
);

it("rejects malformed mail containers in the decoded schema", () => {
	const document = tinyEditorFixture();
	// This external value deliberately violates the generated container type.
	// Validation belongs to that schema, before constructing a SaveDocument.
	const external = {
		...document.SaveGame,
		player: {
			...document.SaveGame.player,
			mailReceived: { unsupported: true },
		},
	};
	expect(() => Schema.decodeUnknownSync(ValueSchema)(external)).toThrow(
		Schema.SchemaError,
	);
});
