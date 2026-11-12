import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { keyComparisonSchema } from "./mappings/key-identities.ts";
import * as Xml from "./xml-codecs.ts";
import { FragmentXmlSchema } from "./tests/fixtures/object-keys.generated.ts";

const xml = await readFile(
	new URL("./tests/fixtures/object-keys.xml", import.meta.url),
	"utf8",
);
const decode = (source: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(source));
const encode = (data: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(data));
const parse = (source: string) => Effect.runPromise(Xml.parseFragment(source));

test("object dictionary keys retain bigint fields, order and XML provenance", async () => {
	const data = await decode(xml);
	const entries = data.value.friendships.value;
	const key = entries[0]?.value.key;
	assert.ok(key);
	const first: bigint = key.value.Farmer1;
	assert.equal(first, 9007199254740993n);
	assert.equal(key.value.Farmer2, 2n);
	assert.equal(entries[2]?.value.key.value.Farmer1, 2n);
	assert.equal(entries[2]?.value.key.value.Farmer2, 9007199254740993n);
	assert.deepEqual(await parse(await encode(data)), await parse(xml));
});

test("FarmerPair duplicate detection ignores numeric spelling and unknown XML", async () => {
	const duplicate = xml.replace(
		"<Farmer2>3</Farmer2>",
		"<Farmer2>0002</Farmer2>",
	);
	await assert.rejects(decode(duplicate), /Duplicate dictionary key/);
	const data = await decode(xml);
	const [first, second] = data.value.friendships.value;
	assert.ok(first && second);
	// Retain the second key's XML while editing its identity to equal the first.
	const edited = {
		...second,
		value: {
			...second.value,
			key: {
				...second.value.key,
				value: { ...second.value.key.value, Farmer2: 2n },
			},
		},
	};
	await assert.rejects(
		encode({
			...data,
			value: {
				...data.value,
				friendships: { ...data.value.friendships, value: [first, edited] },
			},
		}),
		/Duplicate dictionary key/,
	);
});

test("key comparison schema overrides do not change full XML codec equivalence", async () => {
	const codec = Xml.structure({
		Farmer1: Xml.field("Farmer1", Xml.Int64),
		Farmer2: Xml.field("Farmer2", Xml.Int64),
	});
	const a = await Effect.runPromise(
		Schema.decodeEffect(codec)(
			await parse(
				'<FarmerPair mod="a"><Farmer1>1</Farmer1><Farmer2>2</Farmer2></FarmerPair>',
			),
		),
	);
	const b = await Effect.runPromise(
		Schema.decodeEffect(codec)(
			await parse(
				'<FarmerPair mod="b"><Farmer1>0001</Farmer1><Farmer2>2</Farmer2><future>keep</future></FarmerPair>',
			),
		),
	);
	const full = Schema.toEquivalence(Schema.toType(codec));
	const keyOnly = Schema.toEquivalence(
		keyComparisonSchema(codec, "StardewValley.FarmerPair"),
	);
	assert.equal(full(a, b), false);
	assert.equal(keyOnly(a, b), true);
	assert.equal(Schema.toEquivalence(Schema.toType(codec))(a, b), false);
	assert.equal(
		keyOnly(a, { ...b, value: { Farmer1: 2n, Farmer2: 1n } }),
		false,
	);
});

test("XML-only key edits remain visible to dictionary and parent edit detection", async () => {
	const data = await decode(xml);
	const entry = data.value.friendships.value[0];
	assert.ok(entry);
	const key = entry.value.key;
	const edited = {
		...entry,
		value: {
			...entry.value,
			key: {
				...key,
				original: {
					...key.original,
					attributes: { ...key.original.attributes, mod: "changed-provenance" },
				},
			},
		},
	};
	const output = await encode({
		...data,
		value: {
			...data.value,
			friendships: {
				...data.value.friendships,
				value: [edited, ...data.value.friendships.value.slice(1)],
			},
		},
	});
	assert.match(output, /<FarmerPair mod="changed-provenance">/);
	assert.match(output, /<Farmer1>009007199254740993<\/Farmer1>/);
	assert.match(output, /<future-key>keep<\/future-key>/);
	assert.match(output, /<key flag="key">/);
	assert.equal(
		(await decode(output)).value.friendships.value[0]?.value.key.original
			.attributes.mod,
		"changed-provenance",
	);
});

test("key identities require registration and reject changed CLR struct shapes", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/object-keys.catalog.json", import.meta.url),
			"utf8",
		),
	);
	const unknown = structuredClone(catalog);
	unknown.types[1].id = "Example.UnknownPair";
	unknown.types[3].genericArguments[0] = "Example.UnknownPair";
	assert.throws(
		() => generate(unknown, "Example.Relationships"),
		/requires a registered identity/,
	);
	const changed = structuredClone(catalog);
	changed.types[1].members.push({ name: "Other", type: "System.Int64" });
	assert.throws(
		() => generate(changed, "Example.Relationships"),
		/identity no longer matches/,
	);
	const wrongType = structuredClone(catalog);
	wrongType.types[1].members[0].type = "System.Int32";
	assert.throws(
		() => generate(wrongType, "Example.Relationships"),
		/identity no longer matches/,
	);
	assert.match(
		generate(catalog, "Example.Relationships"),
		/"StardewValley.FarmerPair"\)/,
	);
});

test("registered object keys also work in fresh recursive generated dictionaries", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/object-keys.catalog.json", import.meta.url),
			"utf8",
		),
	);
	catalog.types[2].members.push({ name: "Related", type: "ListFriendship" });
	catalog.types.push({
		id: "ListFriendship",
		kind: "collection",
		elementType: "StardewValley.Friendship",
	});
	const directory = await mkdtemp(
		fileURLToPath(new URL("./.object-key-test-", import.meta.url)),
	);
	try {
		const file = join(directory, "generated.ts");
		await writeFile(
			file,
			generate(catalog, "Example.Relationships", "../xml-codecs.ts"),
		);
		const module = await import(pathToFileURL(file).href);
		// The dynamically loaded module has no static identity, but its public codec
		// still requires no services and encodes XML text, like the checked fixture.
		const schema: Schema.Codec<unknown, string> = module.FragmentXmlSchema;
		const source = xml.replaceAll("</Points>", "</Points><Related/>");
		const data = await Effect.runPromise(Schema.decodeEffect(schema)(source));
		const output = await Effect.runPromise(Schema.encodeEffect(schema)(data));
		assert.deepEqual(await parse(output), await parse(source));
		await assert.rejects(
			Effect.runPromise(
				Schema.decodeEffect(schema)(
					source.replace("<Farmer2>3</Farmer2>", "<Farmer2>0002</Farmer2>"),
				),
			),
			/Duplicate dictionary key/,
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
