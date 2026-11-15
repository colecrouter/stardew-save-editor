import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

import { Effect, Schema } from "effect";

import { decodeChunks } from "../../../src/lib/save-format/index.ts";
import { ValueSchema, XmlSchema } from "./generated/fixture.ts";

const fixtures = resolve("tools/game-data/tests/fixtures");

// Node owns completion and failure reporting for registered tests. Let module
// initialization finish rather than awaiting a case before later helpers exist.
void test("event codecs consume arbitrarily split text without collecting a source tree", async () => {
	const xml = await readFile(resolve(fixtures, "fixture.xml"), "utf8");
	const chunks = function* () {
		// Split names, entities and attribute values too; transport chunk boundaries
		// must not change the typed result or truncate a final element.
		for (let offset = 0; offset < xml.length; offset += 7)
			yield xml.slice(offset, offset + 7);
	};
	assert.deepEqual(
		await Effect.runPromise(decodeChunks("SaveGame", ValueSchema, chunks())),
		Schema.decodeSync(XmlSchema)(xml),
	);
	await assert.rejects(
		Effect.runPromise(
			decodeChunks("SaveGame", ValueSchema, ["<SaveGame><Money>1"]),
		),
	);
});

void test("committed codecs preserve values after creation and reordering", async () => {
	const original = Schema.decodeSync(XmlSchema)(
		await readFile(resolve(fixtures, "fixture.xml"), "utf8"),
	);
	assert.equal(original.FarmerId, 9007199254740993n);
	assert.equal(original.Name, "007");
	assert.equal(original.Day, null);
	assert.equal(original.Status, "Ready");
	assert.equal(original.Equipped?.$type, "StardewValley.Tool");
	assert.throws(() =>
		Schema.decodeUnknownSync(ValueSchema)({ ...original, Money: "invalid" }),
	);
	// Edit a detached value so serialization must reconstruct presence, concrete
	// item types and list order without relying on the original XML representation.
	const edited = {
		...structuredClone(original),
		Money: 42,
		Status: "Done",
		Equipped: null,
		Day: 19,
		Items: [
			null,
			{ $type: "StardewValley.Tool" as const, Name: "new", Level: 4 },
			...(original.Items ?? []).filter((item) => item !== null),
		],
	};
	const xml = Schema.encodeSync(XmlSchema)(edited);
	assert.doesNotMatch(xml, /<Equipped/);
	assert.equal(Schema.decodeSync(XmlSchema)(xml).Equipped, null);
	assert.deepEqual(Schema.decodeSync(XmlSchema)(xml), edited);
});
