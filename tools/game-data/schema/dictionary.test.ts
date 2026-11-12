import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { dictionary, fromXml, Int32, parseFragment } from "./xml-codecs.ts";
import { FragmentXmlSchema } from "./tests/fixtures/dictionary.generated.ts";
const xml = await readFile(
	new URL("./tests/fixtures/dictionary.xml", import.meta.url),
	"utf8",
);
const decode = (input: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(input));
const encode = (value: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(value));
const parse = (input: string) => Effect.runPromise(parseFragment(input));

test("generated dictionaries infer scalar and polymorphic payloads and preserve no-op XML", async () => {
	const data = await decode(xml);
	const entry = data.value.Labels.value[0];
	assert.ok(entry);
	const key: string = entry.value.key;
	const value: string = entry.value.value;
	assert.equal(key, "SomeMod/Setting");
	assert.equal(value, "enabled");
	assert.equal(data.value.Animals.value[0]?.value.value.type, "Example.Dog");
	assert.deepEqual(await parse(await encode(data)), await parse(xml));
});

test("dictionary edits preserve entry, key/value wrapper, and unknown XML", async () => {
	const data = await decode(xml);
	const entry = data.value.Labels.value[0];
	assert.ok(entry);
	const output = await encode({
		...data,
		value: {
			...data.value,
			Labels: {
				...data.value.Labels,
				value: [{ ...entry, value: { ...entry.value, value: "disabled" } }],
			},
		},
	});
	assert.match(
		output,
		/<value flag="value"><string>disabled<\/string><future-payload>keep<\/future-payload><\/value><!-- entry note --><future-entry>keep<\/future-entry>/,
	);
	assert.match(
		output,
		/<key flag="key"><string>SomeMod\/Setting<\/string><!-- key note --><\/key>/,
	);
	assert.match(output, /<future-dictionary>keep<\/future-dictionary>/);
});

test("dictionary removal and insertion preserve entry provenance", async () => {
	const data = await decode(xml);
	const entry = data.value.Labels.value[0];
	assert.ok(entry);
	const empty = {
		...data,
		value: { ...data.value, Labels: { ...data.value.Labels, value: [] } },
	};
	const removed = await encode(empty);
	assert.match(
		removed,
		/<Labels flag="dictionary"><future-dictionary>keep<\/future-dictionary><\/Labels>/,
	);
	const restored = await decode(removed);
	const output = await encode({
		...restored,
		value: {
			...restored.value,
			Labels: {
				...restored.value.Labels,
				value: [
					entry,
					{ ...entry, value: { key: "another", value: "second" } },
				],
			},
		},
	});
	assert.deepEqual(
		(await decode(output)).value.Labels.value.map((entry) => entry.value.key),
		["SomeMod/Setting", "another"],
	);
	assert.equal((output.match(/mod="entry"/g) ?? []).length, 2);
});

test("dictionary object values retain derived fields and unknown XML", async () => {
	const data = await decode(xml);
	const entry = data.value.Animals.value[0];
	assert.ok(entry);
	const dog = entry.value.value;
	if (dog.type !== "Example.Dog") throw new Error("Expected dog fixture");
	const output = await encode({
		...data,
		value: {
			...data.value,
			Animals: {
				...data.value.Animals,
				value: [
					{
						...entry,
						value: {
							...entry.value,
							value: { ...dog, value: { ...dog.value, BarkCount: 4 } },
						},
					},
				],
			},
		},
	});
	assert.match(
		output,
		/<BarkCount>4<\/BarkCount><future-dog>keep<\/future-dog>/,
	);
});

test("dictionary string compatibility aliases survive no-op and canonicalize edits", async () => {
	const legacy = xml
		.replace(
			"<string>SomeMod/Setting</string>",
			"<LocationContext>Default</LocationContext>",
		)
		.replace("<string>enabled</string>", "<int>0007</int>");
	const data = await decode(legacy);
	const entry = data.value.Labels.value[0];
	assert.ok(entry);
	assert.deepEqual(entry.value, { key: "Default", value: "7" });
	assert.deepEqual(await parse(await encode(data)), await parse(legacy));
	const output = await encode({
		...data,
		value: {
			...data.value,
			Labels: {
				...data.value.Labels,
				value: [{ ...entry, value: { key: "changed", value: "text" } }],
			},
		},
	});
	assert.match(output, /<string>changed<\/string>/);
	assert.match(output, /<string>text<\/string>/);
	assert.doesNotMatch(output, /<LocationContext>|<int>/);
	await assert.rejects(
		decode(legacy.replace("<int>0007</int>", "<int>2147483648</int>")),
	);
});

test("dictionary rejects duplicate keys, missing wrappers, and ambiguous payloads", async () => {
	const entry = xml.match(/<item mod="entry">[\s\S]*?<\/item>/)?.[0];
	assert.ok(entry);
	await assert.rejects(
		decode(xml.replace(entry, entry + entry)),
		/Duplicate dictionary key/,
	);
	await assert.rejects(
		decode(
			xml
				.replace('<key flag="key">', '<wrong flag="key">')
				.replace("</key><!--", "</wrong><!--"),
		),
	);
	await assert.rejects(
		decode(
			xml.replace(
				"<string>enabled</string>",
				"<string>enabled</string><string>other</string>",
			),
		),
	);
	const data = await decode(xml);
	const first = data.value.Labels.value[0];
	assert.ok(first);
	await assert.rejects(
		encode({
			...data,
			value: {
				...data.value,
				Labels: { ...data.value.Labels, value: [first, first] },
			},
		}),
		/Duplicate dictionary key/,
	);
});

test("dictionary scalar keys compare decoded values rather than XML spellings", async () => {
	const codec = fromXml(
		dictionary("int", Int32, "string", Schema.String, false),
	);
	const entry = (key: string) =>
		`<item><key><int>${key}</int></key><value><string>x</string></value></item>`;
	await assert.rejects(
		Effect.runPromise(
			Schema.decodeEffect(codec)(
				`<dictionary>${entry("0007")}${entry("7")}</dictionary>`,
			),
		),
		/Duplicate dictionary key/,
	);
	const empty = await Effect.runPromise(
		Schema.decodeEffect(codec)("<dictionary/>"),
	);
	assert.deepEqual(empty.value, []);
});

test("custom serializer recognition requires explicit generic metadata", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/dictionary.catalog.json", import.meta.url),
			"utf8",
		),
	);
	const dictionaryType = catalog.types.find(
		(type: { genericDefinition?: string }) => type.genericDefinition,
	);
	delete dictionaryType.genericArguments;
	assert.throws(
		() => generate(catalog, "Example.Container"),
		/reinspect the game/,
	);
	dictionaryType.genericDefinition = "Other.CustomSerializer`2";
	assert.throws(
		() => generate(catalog, "Example.Container"),
		/custom XML serializer/,
	);
});

test("real save friendship dictionary uses the registered wrapper layout", async () => {
	const save = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	const fragment = save.match(
		/<friendshipData>[\s\S]*?<\/friendshipData>/,
	)?.[0];
	assert.ok(fragment);
	// Project one real value field while retaining the rest of each Friendship;
	// this checks the dictionary layout without claiming full-save schema support.
	const { structure, element } = await import("./xml-codecs.ts");
	const codec = fromXml(
		dictionary(
			"string",
			Schema.String,
			"Friendship",
			structure({ Points: element("Points", Int32) }),
			true,
		),
	);
	const decoded = await Effect.runPromise(Schema.decodeEffect(codec)(fragment));
	assert.equal(decoded.value[0]?.value.key, "Lewis");
	assert.equal(decoded.value[0]?.value.value.value.Points, 14);
	const output = await Effect.runPromise(Schema.encodeEffect(codec)(decoded));
	assert.deepEqual(await parse(output), await parse(fragment));
});
