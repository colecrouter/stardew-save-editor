import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import * as Xml from "./xml-codecs.ts";
import { generate } from "./generate.ts";
import { collectionItemName, rootElementName } from "./mappings/type-names.ts";
import { decodeCatalog } from "./compiler/catalog.ts";
import { FragmentXmlSchema } from "./tests/fixtures/array.generated.ts";

const xml = await readFile(
	new URL("./tests/fixtures/array.xml", import.meta.url),
	"utf8",
);
const decode = (source: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(source));
const encode = (data: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(data));
const parse = (source: string) => Effect.runPromise(Xml.parseFragment(source));

test("Xml.array composes with scalar and nullable value definitions", async () => {
	const schema = Xml.fromXml(
		Xml.structure({
			Numbers: Xml.field("Numbers", Xml.array(Xml.Int32)),
			Optional: Xml.field("Optional", Xml.nullable(Xml.array(Xml.Int32))),
		}),
	);
	const source =
		'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><Numbers><int>0001</int><future>keep</future></Numbers><Optional i:nil="true"/></Root>';
	const data = await Effect.runPromise(Schema.decodeEffect(schema)(source));
	const numbers: readonly number[] = data.value.Numbers;
	const optional: readonly number[] | null = data.value.Optional;
	assert.deepEqual(numbers, [1]);
	assert.equal(optional, null);
	const output = await Effect.runPromise(
		Schema.encodeEffect(schema)({
			...data,
			value: { ...data.value, Numbers: [1, 2], Optional: [] },
		}),
	);
	assert.match(output, /<int>0001<\/int><int>2<\/int><future>keep<\/future>/);
	assert.deepEqual(
		(await Effect.runPromise(Schema.decodeEffect(schema)(output))).value
			.Optional,
		[],
	);
});

test("dictionary array values decode as typed arrays and preserve no-op XML", async () => {
	const data = await decode(xml);
	const stats: readonly number[] | undefined =
		data.value.stats.value[0]?.value.value;
	assert.deepEqual(stats, [1, 2]);
	const matrix: readonly (readonly number[] | null)[] | undefined =
		data.value.matrix.value[0]?.value.value;
	assert.deepEqual(matrix, [[3], null, []]);
	const nodes = data.value.nodes.value[0]?.value.value;
	assert.equal(nodes?.[0]?.value.Name, "root");
	assert.equal(nodes?.[1], null);
	assert.deepEqual(await parse(await encode(data)), await parse(xml));
});

test("array dictionary edits preserve payload wrappers, unchanged item spelling and unknown XML", async () => {
	const data = await decode(xml);
	const entry = data.value.stats.value[0];
	assert.ok(entry);
	const output = await encode({
		...data,
		value: {
			...data.value,
			stats: {
				...data.value.stats,
				value: [{ ...entry, value: { ...entry.value, value: [1, 7, 9] } }],
			},
		},
	});
	assert.match(
		output,
		/<ArrayOfInt mod="array"><int mod="first">0001<\/int><!-- between --><future>keep<\/future><int>7<\/int><int>9<\/int><\/ArrayOfInt>/,
	);
	assert.match(output, /<value mod="value">/);
	assert.match(output, /<!-- value note -->/);
	const cleared = await encode({
		...data,
		value: {
			...data.value,
			stats: {
				...data.value.stats,
				value: [{ ...entry, value: { ...entry.value, value: [] } }],
			},
		},
	});
	assert.deepEqual(
		(await decode(cleared)).value.stats.value[0]?.value.value,
		[],
	);
	assert.match(
		cleared,
		/<ArrayOfInt mod="array"><!-- between --><future>keep<\/future><\/ArrayOfInt>/,
	);
});

test("recursive object arrays preserve item provenance and nullable slot positions", async () => {
	const data = await decode(xml);
	const entry = data.value.nodes.value[0];
	assert.ok(entry);
	const node = entry.value.value[0];
	assert.ok(node);
	const output = await encode({
		...data,
		value: {
			...data.value,
			nodes: {
				...data.value.nodes,
				value: [
					{
						...entry,
						value: {
							...entry.value,
							value: [
								null,
								{ ...node, value: { ...node.value, Name: "edited" } },
								node,
							],
						},
					},
				],
			},
		},
	});
	const values = (await decode(output)).value.nodes.value[0]?.value.value;
	assert.equal(values?.length, 3);
	assert.equal(values?.[0], null);
	assert.equal(values?.[1]?.value.Name, "edited");
	assert.equal(values?.[2]?.value.Name, "root");
	assert.equal(
		(output.match(/<future-node>keep<\/future-node>/g) ?? []).length,
		2,
	);
});

test("array values enforce item codecs and wrapper names", async () => {
	await assert.rejects(
		decode(xml.replace("<int>002</int>", "<int>2147483648</int>")),
	);
	await assert.rejects(decode(xml.replace("<int>002</int>", "<int>1.5</int>")));
	await assert.rejects(
		decode(
			xml
				.replace('<ArrayOfInt mod="array">', '<Wrong mod="array">')
				.replace(
					"</ArrayOfInt><!-- value note -->",
					"</Wrong><!-- value note -->",
				),
		),
	);
	await assert.rejects(
		decode(
			xml.replace(
				'<Node i:nil="1" mod="empty"/>',
				'<Node i:nil="true"><Name>invalid</Name></Node>',
			),
		),
	);
	const data = await decode(xml);
	const entry = data.value.stats.value[0];
	assert.ok(entry);
	await assert.rejects(
		encode({
			...data,
			value: {
				...data.value,
				stats: {
					...data.value.stats,
					value: [{ ...entry, value: { ...entry.value, value: [2147483648] } }],
				},
			},
		}),
	);
});

test("array payload naming differs from CLR generic-argument naming", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/array.catalog.json", import.meta.url),
			"utf8",
		),
	);
	const types = decodeCatalog(catalog);
	assert.equal(rootElementName(types, "System.Int32[]"), "ArrayOfInt");
	assert.equal(
		collectionItemName(types, "System.Int32[][]"),
		"ArrayOfArrayOfInt",
	);
	assert.equal(
		collectionItemName(
			types,
			"StardewValley.SerializableDictionary`2[System.String,System.Int32[]]",
		),
		"SerializableDictionaryOfStringArrayOfInt32",
	);
	const source = generate(catalog, "Example.Arrays");
	assert.match(source, /Xml.array\(/);
	assert.match(source, /Schema.suspend/);

	const rectangular = structuredClone(catalog);
	rectangular.types[0].members.push({ name: "Rect", type: "System.Int32[,]" });
	rectangular.types.push({
		id: "System.Int32[,]",
		kind: "collection",
		baseType: "System.Array",
		elementType: "System.Int32",
	});
	assert.throws(
		() => generate(rectangular, "Example.Arrays"),
		/multidimensional arrays are unsupported/,
	);
	const invalid = structuredClone(catalog);
	invalid.types[2].elementType = invalid.types[2].id;
	assert.throws(() => generate(invalid, "Example.Arrays"), /recursive array/);
});

test("array item naming does not mutate shared scalar definitions", () => {
	Xml.textValue(Schema.String);
	assert.equal(Xml.String.itemName, "string");
	assert.equal(Xml.array(Xml.String).itemName, "ArrayOfString");
});

test("real save ArrayOfInt payload uses the same composable array codec", async () => {
	const save = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	const fragment = save.match(/<ArrayOfInt>[\s\S]*?<\/ArrayOfInt>/)?.[0];
	assert.ok(fragment);
	// Give the payload an owning envelope so formatting and unknown wrapper data
	// have the same preservation path as dictionary value bindings.
	const schema = Xml.fromXml(
		Xml.structure({ Value: Xml.field("ArrayOfInt", Xml.array(Xml.Int32)) }),
	);
	const source = `<value>${fragment}</value>`;
	const data = await Effect.runPromise(Schema.decodeEffect(schema)(source));
	assert.deepEqual(data.value.Value, [1, 2]);
	assert.deepEqual(
		await parse(await Effect.runPromise(Schema.encodeEffect(schema)(data))),
		await parse(source),
	);
});
