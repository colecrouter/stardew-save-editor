import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { ordinalIgnoreCaseKey } from "./mappings/ordinal-ignore-case.ts";
import { FragmentXmlSchema } from "./tests/fixtures/case-insensitive-dictionary.generated.ts";
import * as Xml from "./xml-codecs.ts";

const decode = Schema.decodeSync(FragmentXmlSchema);
const encode = Schema.encodeSync(FragmentXmlSchema);
const parse = (xml: string) => Effect.runPromise(Xml.parseFragment(xml));
const entry = (key: string, value = "0001") =>
	`<item mod="entry"><key flag="key"><string>${key}</string><!-- key note --></key><value><int>${value}</int></value><future>keep</future></item>`;
const wrap = (entries: string) =>
	`<Stats><Values/><specificMonstersKilled>${entries}<unknown>keep</unknown></specificMonstersKilled></Stats>`;

// These pairs were checked against StringComparer.OrdinalIgnoreCase on .NET.
// They distinguish ordinal simple casing from locale rules, full Unicode folding,
// normalization and JavaScript's potentially newer Unicode uppercase tables.
const equalPairs = [
	["Rock Crab", "ROCK CRAB"],
	["é", "É"],
	["σ", "ς"],
	["ᾀ", "ᾈ"],
	["𐐀", "𐐨"],
] as const;
const differentPairs = [
	["ß", "SS"],
	["ß", "ẞ"],
	["ı", "I"],
	["İ", "i"],
	["ſ", "S"],
	["K", "k"],
	["ﬀ", "FF"],
	["é", "é"],
	["Rock Crab", "Rock Crab "],
] as const;

test("case-insensitive dictionaries enforce ordinal key equality on decode", () => {
	for (const [left, right] of equalPairs) {
		assert.equal(ordinalIgnoreCaseKey(left), ordinalIgnoreCaseKey(right));
		assert.throws(
			() => decode(wrap(entry(left) + entry(right))),
			/Duplicate dictionary key/,
		);
	}
	for (const [left, right] of differentPairs) {
		assert.notEqual(ordinalIgnoreCaseKey(left), ordinalIgnoreCaseKey(right));
		assert.equal(
			decode(wrap(entry(left) + entry(right))).value.specificMonstersKilled
				.value.length,
			2,
		);
	}
});

test("case-insensitive duplicate checking also validates edited entries on encode", () => {
	const data = decode(wrap(entry("Rock Crab") + entry("Bat")));
	const [first, second] = data.value.specificMonstersKilled.value;
	assert.ok(first && second);
	assert.throws(
		() =>
			encode({
				...data,
				value: {
					...data.value,
					specificMonstersKilled: {
						...data.value.specificMonstersKilled,
						value: [
							first,
							{ ...second, value: { ...second.value, key: "ROCK CRAB" } },
						],
					},
				},
			}),
		/Duplicate dictionary key/,
	);
});

test("case-only edits keep key spelling meaningful and preserve other XML", async () => {
	const xml = wrap(entry("Rock Crab"));
	const data = decode(xml);
	const first = data.value.specificMonstersKilled.value[0];
	assert.ok(first);
	const key: string = first.value.key;
	const value: number = first.value.value;
	assert.deepEqual([key, value], ["Rock Crab", 1]);
	assert.deepEqual(await parse(encode(data)), await parse(xml));
	const output = encode({
		...data,
		value: {
			...data.value,
			specificMonstersKilled: {
				...data.value.specificMonstersKilled,
				value: [{ ...first, value: { ...first.value, key: "ROCK CRAB" } }],
			},
		},
	});
	assert.deepEqual(
		await parse(output),
		await parse(xml.replace("Rock Crab", "ROCK CRAB")),
	);
});

test("ordinary dictionaries retain case-sensitive string keys", () => {
	const ordinary = Xml.fromXml(
		Xml.dictionary("string", Schema.String, "int", Xml.Int32, false),
	);
	const xml = `<dictionary>${entry("Bat")}${entry("BAT")}</dictionary>`;
	assert.equal(Schema.decodeSync(ordinary)(xml).value.length, 2);
});

test("actual saved monster and stat dictionaries round-trip with typed values", async () => {
	const text = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	const monsters = text.match(
		/<specificMonstersKilled>[\s\S]*?<\/specificMonstersKilled>/,
	)?.[0];
	const values = text.match(/<Values>[\s\S]*?<\/Values>/)?.[0];
	assert.ok(monsters && values);
	const xml = `<Stats>${values}${monsters}</Stats>`;
	const data = decode(xml);
	assert.equal(
		data.value.specificMonstersKilled.value[0]?.value.key,
		"Rock Crab",
	);
	assert.equal(data.value.specificMonstersKilled.value[0]?.value.value, 1);
	assert.equal(
		data.value.Values.value.find((entry) => entry.value.key === "daysPlayed")
			?.value.value,
		6,
	);
	assert.deepEqual(await parse(encode(data)), await parse(xml));
});

test("case-insensitive dictionary metadata requires exactly one value argument", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL(
				"./tests/fixtures/case-insensitive-dictionary.catalog.json",
				import.meta.url,
			),
			"utf8",
		),
	);
	for (const args of [
		undefined,
		[],
		["System.Int32", "System.String"],
		["Missing.Value"],
	]) {
		const changed = structuredClone(catalog);
		if (args === undefined) delete changed.types[1].genericArguments;
		else changed.types[1].genericArguments = args;
		assert.throws(
			() => generate(changed, "Example.Stats"),
			/requires one value argument|unsupported value type Missing.Value/,
		);
	}
});

test("case-insensitive dictionary payloads contribute known object variants", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL(
				"./tests/fixtures/case-insensitive-dictionary.catalog.json",
				import.meta.url,
			),
			"utf8",
		),
	);
	// Includes on a dictionary's value type must be discovered before resolving
	// its polymorphic codec, just as for the ordinary two-argument dictionary.
	catalog.types[1].genericArguments = ["Example.Payload"];
	catalog.types.push(
		{
			id: "Example.Payload",
			kind: "object",
			isAbstract: true,
			attributes: [
				{
					type: "System.Xml.Serialization.XmlIncludeAttribute",
					constructorArguments: [
						{ type: "System.Type", value: "Example.DerivedPayload" },
					],
				},
			],
		},
		{
			id: "Example.DerivedPayload",
			kind: "object",
			baseType: "Example.Payload",
			members: [{ name: "Name", type: "System.String" }],
		},
	);
	const source = generate(catalog, "Example.Stats");
	assert.match(source, /Xml\.variant\("Example.DerivedPayload"/);
	assert.match(source, /"ordinalIgnoreCase"/);
});
