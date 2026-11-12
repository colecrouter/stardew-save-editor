import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { FragmentXmlSchema } from "./tests/fixtures/empty-object.generated.ts";
import * as Xml from "./xml-codecs.ts";

const catalog = JSON.parse(
	await readFile(
		new URL("./tests/fixtures/empty-object.catalog.json", import.meta.url),
		"utf8",
	),
);
const decode = Schema.decodeSync(FragmentXmlSchema);
const encode = Schema.encodeSync(FragmentXmlSchema);
const parse = (xml: string) => Effect.runPromise(Xml.parseFragment(xml));

test("generation accepts empty ordinary objects as roots and nested fields", async () => {
	const source = generate(catalog, "Example.Mine", "../../xml-codecs.ts");
	assert.match(source, /mineRandom: Xml.optional\(Xml\.field/);
	assert.match(generate(catalog, "System.Random"), /Xml\.structure\(/);
	// An empty decoded payload represents the XML contract, not PRNG state.
	const data = decode("<Mine><level>1</level><mineRandom /></Mine>");
	assert.deepEqual(data.value.mineRandom.value, {});
	assert.deepEqual(
		await parse(encode(data)),
		await parse("<Mine><level>1</level><mineRandom /></Mine>"),
	);
});

test("empty objects preserve unfamiliar content while neighboring fields change", async () => {
	const xml =
		'<Mine><level>0001</level><mineRandom mod="keep"><!-- note --><future>state</future></mineRandom></Mine>';
	const data = decode(xml);
	assert.deepEqual(data.value.mineRandom.value, {});
	assert.deepEqual(await parse(encode(data)), await parse(xml));
	// Editing modeled data must not discard extensions inside an empty contract.
	const output = encode({ ...data, value: { ...data.value, level: 2 } });
	assert.deepEqual(await parse(output), await parse(xml.replace("0001", "2")));
});

test("empty objects do not bypass missing types or custom serializer boundaries", () => {
	assert.throws(
		() =>
			generate(
				{ ...catalog, types: catalog.types.slice(0, 1) },
				"Example.Mine",
			),
		/System.Random/,
	);
	const custom = {
		...catalog,
		types: catalog.types.map((type: { id: string }) =>
			type.id === "System.Random" ? { ...type, customXml: true } : type,
		),
	};
	assert.throws(
		() => generate(custom, "Example.Mine"),
		/custom XML|custom serializer/i,
	);
});
