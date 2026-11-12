import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { decodeCatalog } from "./compiler/catalog.ts";
import { resolveContract } from "./compiler/contract.ts";
import { generate } from "./generate.ts";
import {
	collectionItemName,
	serializationNames,
} from "./mappings/type-names.ts";
import { FragmentXmlSchema } from "./tests/fixtures/generic-collection.generated.ts";
import { parseFragment } from "./xml-codecs.ts";

const catalog = JSON.parse(
	await readFile(
		new URL(
			"./tests/fixtures/generic-collection.catalog.json",
			import.meta.url,
		),
		"utf8",
	),
);
const dictionary =
	"StardewValley.SerializableDictionary`2[System.Int64,StardewValley.Inventories.Inventory]";
const inventory = "StardewValley.Inventories.Inventory";

test("generic collection names match XmlSerializer without borrowing standalone XmlRoot names", () => {
	const types = decodeCatalog(catalog);
	assert.equal(
		collectionItemName(types, dictionary),
		"SerializableDictionaryOfInt64Inventory",
	);
	assert.equal(serializationNames(types, dictionary).rootName, "dictionary");
	assert.equal(collectionItemName(types, inventory), "Inventory");
	assert.equal(serializationNames(types, inventory).rootName, "items");
	assert.equal(collectionItemName(types, "System.Int64"), "long");
	const field = resolveContract(types, "Example.Container").root.fields.find(
		(field) => field.memberName === "Wallets",
	);
	assert.ok(field && "itemName" in field);
	assert.equal(field.itemName, "SerializableDictionaryOfInt64Inventory");
});

test("generic dictionary collections round-trip typed Inventory payloads and preserve XML during edits", async () => {
	const xml = await readFile(
		new URL("./tests/fixtures/generic-collection.xml", import.meta.url),
		"utf8",
	);
	const data = await Effect.runPromise(
		Schema.decodeEffect(FragmentXmlSchema)(xml),
	);
	const wallet = data.value.Wallets[0];
	assert.ok(wallet);
	const entry = wallet.value[0];
	assert.ok(entry);
	const key: bigint = entry.value.key;
	assert.equal(key, 42n);
	assert.equal(entry.value.value.value[0]?.value, null);
	const output = await Effect.runPromise(
		Schema.encodeEffect(FragmentXmlSchema)(data),
	);
	const parse = (input: string) => Effect.runPromise(parseFragment(input));
	assert.deepEqual(await parse(output), await parse(xml));
	const edited = await Effect.runPromise(
		Schema.encodeEffect(FragmentXmlSchema)({
			...data,
			value: {
				...data.value,
				Wallets: [
					{
						...wallet,
						value: [{ ...entry, value: { ...entry.value, key: 43n } }],
					},
				],
			},
		}),
	);
	assert.match(edited, /<long>43<\/long>/);
	assert.match(edited, /<SerializableDictionaryOfInt64Inventory mod="wallet">/);
	assert.match(edited, /<Item i:nil="true" mod="slot"/);
	assert.match(edited, /<future-dictionary>keep<\/future-dictionary>/);
});

test("explicit collection item overrides retain priority over generic defaults", () => {
	const input = structuredClone(catalog);
	input.types[0].members.find(
		(member: { name: string }) => member.name === "Wallets",
	).attributes = [
		{
			type: "System.Xml.Serialization.XmlArrayItemAttribute",
			constructorArguments: [{ type: "System.String", value: "Wallet" }],
		},
	];
	const field = resolveContract(
		decodeCatalog(input),
		"Example.Container",
	).root.fields.find((field) => field.memberName === "Wallets");
	assert.ok(field && "itemName" in field);
	assert.equal(field.itemName, "Wallet");
});

test("generic argument names use CLR defaults while direct item names honor XmlType", () => {
	const input = structuredClone(catalog);
	input.types
		.find((type: { id: string }) => type.id === inventory)
		.attributes.push({
			type: "System.Xml.Serialization.XmlTypeAttribute",
			constructorArguments: [{ type: "System.String", value: "Bag" }],
		});
	const types = decodeCatalog(input);
	assert.equal(collectionItemName(types, inventory), "Bag");
	assert.equal(
		collectionItemName(types, dictionary),
		"SerializableDictionaryOfInt64Inventory",
	);
	const nested = {
		...input.types.find((type: { id: string }) => type.id === dictionary),
		id: "NestedDictionary",
		genericArguments: ["System.String", dictionary],
	};
	input.types.push(nested);
	assert.equal(
		collectionItemName(decodeCatalog(input), nested.id),
		"SerializableDictionaryOfStringSerializableDictionaryOfInt64Inventory",
	);
});

test("generic naming fails explicitly on incomplete or recursive metadata", () => {
	const input = structuredClone(catalog);
	const type = input.types.find(
		(type: { id: string }) => type.id === dictionary,
	);
	delete type.genericArguments;
	// Exercise naming directly: graph discovery now validates dictionary payload
	// arguments before generation reaches the naming stage.
	assert.throws(
		() => collectionItemName(decodeCatalog(input), dictionary),
		/generic naming metadata.*reinspect/,
	);
	type.genericArguments = ["System.Int64", dictionary];
	assert.throws(
		() => generate(input, "Example.Container"),
		/recursive generic naming metadata/,
	);
});
