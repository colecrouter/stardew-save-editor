import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { decodeCatalog } from "./compiler/catalog.ts";
import { generate } from "./generate.ts";
import { collectionItemName, rootElementName } from "./mappings/type-names.ts";
import { FragmentXmlSchema } from "./tests/fixtures/list.generated.ts";
import * as Xml from "./xml-codecs.ts";

const xml = (
	await readFile(new URL("./tests/fixtures/list.xml", import.meta.url), "utf8")
).trim();
const catalog = JSON.parse(
	await readFile(
		new URL("./tests/fixtures/list.catalog.json", import.meta.url),
		"utf8",
	),
);
const decode = Schema.decodeSync(FragmentXmlSchema);
const encode = Schema.encodeSync(FragmentXmlSchema);
const parse = (source: string) => Effect.runPromise(Xml.parseFragment(source));
const list = (item: string) => `System.Collections.Generic.List\`1[${item}]`;

test("dictionary list values infer scalar, nested and polymorphic item types", async () => {
	const data = decode(xml);
	const numbers: readonly number[] | undefined =
		data.value.stats.value[0]?.value.value;
	const matrix: readonly (readonly number[] | null)[] | undefined =
		data.value.matrix.value[0]?.value.value;
	const words: readonly (string | null)[] | undefined =
		data.value.words.value[0]?.value.value;
	assert.deepEqual(numbers, [1, 2]);
	assert.deepEqual(matrix, [[3], null, []]);
	assert.deepEqual(words, ["one", null]);
	assert.deepEqual(data.value.bytes.value[0]?.value.value, [255, 0]);
	const node = data.value.nodes.value[0]?.value.value[0];
	assert.ok(node && node.type === "Example.SpecialNode");
	const count: number = node.value.Count;
	assert.equal(count, 2);
	assert.equal(data.value.nodes.value[0]?.value.value[1], null);
	assert.deepEqual(await parse(encode(data)), await parse(xml));
});

test("list value edits preserve wrappers, scalar spelling and unknown XML", async () => {
	const data = decode(xml);
	const entry = data.value.stats.value[0];
	assert.ok(entry);
	const edited = (values: readonly number[]) =>
		encode({
			...data,
			value: {
				...data.value,
				stats: {
					...data.value.stats,
					value: [{ ...entry, value: { ...entry.value, value: values } }],
				},
			},
		});
	const output = edited([1, 7, 9]);
	assert.match(
		output,
		/<ArrayOfInt mod="array"><int mod="first">0001<\/int><!-- between --><future>keep<\/future><int>7<\/int><int>9<\/int><\/ArrayOfInt>/,
	);
	assert.match(output, /<value mod="value">/);
	assert.match(output, /<!-- value note -->/);
	const cleared = edited([]);
	assert.deepEqual(decode(cleared).value.stats.value[0]?.value.value, []);
	assert.match(
		cleared,
		/<ArrayOfInt mod="array"><!-- between --><future>keep<\/future><\/ArrayOfInt>/,
	);
});

test("recursive polymorphic lists retain null slots and moved item provenance", () => {
	const data = decode(xml);
	const entry = data.value.nodes.value[0];
	assert.ok(entry);
	const node = entry.value.value[0];
	assert.ok(node && node.type === "Example.SpecialNode");
	const output = encode({
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
								{ ...node, value: { ...node.value, Count: 3 } },
								node,
							],
						},
					},
				],
			},
		},
	});
	const values = decode(output).value.nodes.value[0]?.value.value;
	assert.equal(values?.length, 3);
	assert.equal(values?.[0], null);
	const edited = values?.[1];
	assert.ok(edited && edited.type === "Example.SpecialNode");
	assert.equal(edited.value.Count, 3);
	assert.equal(values?.[2]?.value.Name, "root");
	assert.equal(
		(output.match(/<future-node>keep<\/future-node>/g) ?? []).length,
		2,
	);
});

test("list payloads enforce root names, item codecs and nil contents", () => {
	for (const source of [
		xml
			.replace("<ArrayOfInt mod=", "<ListOfInt32 mod=")
			.replace(
				"</ArrayOfInt><!-- value note -->",
				"</ListOfInt32><!-- value note -->",
			),
		xml.replace(
			"<unsignedByte>255</unsignedByte>",
			"<unsignedByte>256</unsignedByte>",
		),
		xml.replace(
			'<Node i:nil="1" mod="empty"/>',
			'<Node i:nil="true"><Name>bad</Name></Node>',
		),
	])
		assert.throws(() => decode(source));
	const data = decode(xml);
	const entry = data.value.bytes.value[0];
	assert.ok(entry);
	assert.throws(() =>
		encode({
			...data,
			value: {
				...data.value,
				bytes: {
					...data.value.bytes,
					value: [{ ...entry, value: { ...entry.value, value: [256] } }],
				},
			},
		}),
	);
});

test("list payload names follow ArrayOf while enclosing generic names retain CLR List names", () => {
	const types = decodeCatalog(catalog);
	assert.equal(rootElementName(types, list("System.Int32")), "ArrayOfInt");
	assert.equal(
		rootElementName(types, list("System.Byte")),
		"ArrayOfUnsignedByte",
	);
	assert.equal(
		collectionItemName(types, list(list("System.Int32"))),
		"ArrayOfArrayOfInt",
	);
	assert.equal(
		collectionItemName(
			types,
			`StardewValley.SerializableDictionary\`2[System.String,${list("System.Int32")}]`,
		),
		"SerializableDictionaryOfStringListOfInt32",
	);
	const renamed = structuredClone(catalog);
	renamed.types[1].attributes.push({
		type: "System.Xml.Serialization.XmlTypeAttribute",
		constructorArguments: [{ type: "System.String", value: "SavedNode" }],
	});
	assert.equal(
		rootElementName(decodeCatalog(renamed), list("Example.Node")),
		"ArrayOfSavedNode",
	);
});

test("list recognition rejects incomplete metadata and unrelated enumerable value contracts", () => {
	for (const change of [
		(record: Record<string, unknown>) => {
			delete record.elementType;
		},
		(record: Record<string, unknown>) => {
			delete record.genericArguments;
		},
		(record: Record<string, unknown>) => {
			record.genericArguments = ["System.String"];
		},
		(record: Record<string, unknown>) => {
			record.elementType = record.id;
			record.genericArguments = [record.id];
		},
		(record: Record<string, unknown>) => {
			record.genericDefinition = "Example.Unreviewed`1";
		},
		(record: Record<string, unknown>) => {
			record.customXml = true;
		},
	]) {
		const changed = structuredClone(catalog);
		change(changed.types[2]);
		assert.throws(
			() => generate(changed, "Example.Lists"),
			/sequence item metadata|matching generic\/item type|recursive array\/list|unsupported value type/,
		);
	}
});
