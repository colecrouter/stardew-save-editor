import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { FragmentXmlSchema } from "./tests/fixtures/repeated.generated.ts";
import { parseFragment } from "./xml-codecs.ts";

const xml = await readFile(
	new URL("./tests/fixtures/repeated.xml", import.meta.url),
	"utf8",
);
const decode = (input: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(input));
const encode = (value: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(value));
const parse = (input: string) => Effect.runPromise(parseFragment(input));

test("repeated scalar and polymorphic object fields preserve their XML on a no-op", async () => {
	const value = await decode(xml);
	const scores: readonly number[] = value.value.Scores;
	assert.deepEqual(scores, [7, 8]);
	assert.equal(value.value.Pets[0]?.type, "Example.Cat");
	assert.deepEqual(await parse(await encode(value)), await parse(xml));
});

test("repeated scalar edits reuse slots and place additions after the last item", async () => {
	const original = await decode(xml);
	const output = await encode({
		...original,
		value: { ...original.value, Scores: [9, 8, 10] },
	});
	assert.match(
		output,
		/<score flag="keep">9<\/score><!-- between scores --><future-score>keep<\/future-score><score>8<\/score><score>10<\/score><Holder>/,
	);
	const removed = await encode({
		...original,
		value: { ...original.value, Scores: [] },
	});
	assert.doesNotMatch(removed, /<score[ >]/);
	assert.match(
		removed,
		/<!-- between scores --><future-score>keep<\/future-score>/,
	);
});

test("repeated objects carry their own unknown XML through edits and removal", async () => {
	const original = await decode(xml);
	const cat = original.value.Pets[0];
	assert.ok(cat);
	assert.equal(cat.type, "Example.Cat");
	if (cat.type !== "Example.Cat") throw new Error("Expected cat fixture");
	const output = await encode({
		...original,
		value: {
			...original.value,
			Pets: [{ ...cat, value: { ...cat.value, Lives: 8 } }],
		},
	});
	assert.match(
		output,
		/<animal i:type="Kitten"><Name>Miso<\/Name><Lives>8<\/Lives><\/animal><future-list>keep<\/future-list>/,
	);
	assert.doesNotMatch(output, /<Name>Base<\/Name>/);
});

test("absent repeated fields decode as empty and new items append after existing siblings", async () => {
	const template = await decode(xml);
	const pet = template.value.Pets[0];
	assert.ok(pet);
	const emptyXml = xml
		.replace(/<animal\b[^>]*>[\s\S]*?<\/animal>/g, "")
		.replace(/<score\b[^>]*>[\s\S]*?<\/score>/g, "");
	const empty = await decode(emptyXml);
	assert.deepEqual(empty.value.Scores, []);
	assert.deepEqual(empty.value.Pets, []);
	const output = await encode({
		...empty,
		value: { ...empty.value, Scores: [12], Pets: [pet] },
	});
	const tree = await parse(output);
	const names = tree.children
		.filter((node) => node._tag === "Element")
		.map((node) => node.name);
	assert.deepEqual(names.slice(-2), ["animal", "score"]);
	assert.equal((await decode(output)).value.Pets[0]?.type, "Example.Cat");
});

test("repeated scalar elements reject nested or nil values", async () => {
	await assert.rejects(
		decode(xml.replace('flag="keep">0007', 'flag="keep"><nested/>0007')),
	);
	await assert.rejects(decode(xml.replace('flag="keep"', 'i:nil="true"')));
});

test("repeated collection generation is deterministic and rejects wrapper-only annotations", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/repeated.catalog.json", import.meta.url),
			"utf8",
		),
	);
	assert.equal(
		generate(catalog, "Example.Container"),
		generate(catalog, "Example.Container"),
	);
	catalog.types[0].members[1].attributes.push({
		type: "System.Xml.Serialization.XmlArrayItemAttribute",
	});
	assert.throws(
		() => generate(catalog, "Example.Container"),
		/XmlArrayItem requires a wrapped collection/,
	);
});

test("only direct matching children belong to a repeated field", async () => {
	const nested = xml.replace(
		"<future-score>keep</future-score>",
		"<future-score><score>999</score></future-score>",
	);
	const value = await decode(nested);
	assert.deepEqual(value.value.Scores, [7, 8]);
	const output = await encode({
		...value,
		value: { ...value.value, Scores: [] },
	});
	assert.match(output, /<future-score><score>999<\/score><\/future-score>/);
});
