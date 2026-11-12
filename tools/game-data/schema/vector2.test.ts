import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import * as Xml from "./xml-codecs.ts";
import { generate } from "./generate.ts";
import { keyComparisonSchema } from "./mappings/key-identities.ts";
import { FragmentXmlSchema } from "./tests/fixtures/vector2.generated.ts";

const xml = await readFile(
	new URL("./tests/fixtures/vector2.xml", import.meta.url),
	"utf8",
);
const decode = (source: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(source));
const encode = (data: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(data));
const parse = (source: string) => Effect.runPromise(Xml.parseFragment(source));
const vector = Xml.structure({
	X: Xml.field("X", Xml.Single),
	Y: Xml.field("Y", Xml.Single),
});

test("Vector2 dictionary keys use typed binary32 coordinates and preserve no-op XML", async () => {
	const data = await decode(xml);
	const keys = data.value.objects.value.map((entry) => entry.value.key);
	const x: number | undefined = keys[0]?.value.X;
	assert.ok(Object.is(x, -0));
	assert.equal(keys[0]?.value.Y, 2);
	assert.equal(keys[2]?.value.X, 16777216);
	assert.deepEqual(await parse(await encode(data)), await parse(xml));
});

test("Vector2 duplicates compare coordinates after binary32 conversion and equate signed zeros", async () => {
	await assert.rejects(
		decode(xml.replace("<X>3</X><Y>4</Y>", "<X>0</X><Y>2</Y>")),
		/Duplicate dictionary key/,
	);
	await assert.rejects(
		decode(xml.replace("<X>3</X><Y>4</Y>", "<X>16777216</X><Y>5</Y>")),
		/Duplicate dictionary key/,
	);
	const data = await decode(xml);
	const [first, second] = data.value.objects.value;
	assert.ok(first && second);
	const edited = {
		...second,
		value: {
			...second.value,
			key: { ...second.value.key, value: { X: 0, Y: 2 } },
		},
	};
	await assert.rejects(
		encode({
			...data,
			value: {
				...data.value,
				objects: { ...data.value.objects, value: [first, edited] },
			},
		}),
		/Duplicate dictionary key/,
	);
});

test("Vector2 key comparison matches MonoGame for NaN and infinities without changing edit equality", async () => {
	const read = async (x: string, y: string) =>
		Effect.runPromise(
			Schema.decodeEffect(vector)(
				await parse(`<Vector2><X>${x}</X><Y>${y}</Y></Vector2>`),
			),
		);

	const equal = Schema.toEquivalence(
		keyComparisonSchema(vector, "Microsoft.Xna.Framework.Vector2"),
	);
	const negativeZero = await read("-0", "2");
	const positiveZero = await read("0", "2");
	assert.equal(equal(negativeZero, positiveZero), true);
	assert.equal(
		Schema.toEquivalence(Schema.toType(vector))(negativeZero, positiveZero),
		false,
	);
	const nan = await read("NaN", "2");
	assert.equal(equal(nan, nan), false);
	assert.equal(equal(nan, await read("NaN", "2")), false);
	assert.equal(
		equal(await read("INF", "-INF"), await read("INF", "-INF")),
		true,
	);
	const data = await decode(xml);
	const output = await encode({
		...data,
		value: {
			...data.value,
			Position: {
				...data.value.Position,
				value: { ...data.value.Position.value, X: 0 },
			},
		},
	});
	assert.match(output, /<Position><X>0<\/X><Y>NaN<\/Y>/);
	assert.match(output, /<future-position>keep<\/future-position>/);
});

test("NaN-containing Vector2 keys remain distinct even when an entry object is reused", async () => {
	const source = xml.replace("<X>-0</X><Y>02.00</Y>", "<X>NaN</X><Y>2</Y>");
	const data = await decode(source);
	const first = data.value.objects.value[0];
	assert.ok(first);
	const output = await encode({
		...data,
		value: {
			...data.value,
			objects: { ...data.value.objects, value: [first, first] },
		},
	});
	assert.equal((await decode(output)).value.objects.value.length, 2);
});

test("Vector2 key provenance edits stay visible and metadata changes require review", async () => {
	const data = await decode(xml);
	const first = data.value.objects.value[0];
	assert.ok(first);
	const key = first.value.key;
	const edited = {
		...first,
		value: {
			...first.value,
			key: {
				...key,
				original: {
					...key.original,
					attributes: { ...key.original.attributes, mod: "edited" },
				},
			},
		},
	};
	const output = await encode({
		...data,
		value: {
			...data.value,
			objects: {
				...data.value.objects,
				value: [edited, ...data.value.objects.value.slice(1)],
			},
		},
	});
	assert.match(output, /<Vector2 mod="edited"><X>-0<\/X><Y>02.00<\/Y>/);
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/vector2.catalog.json", import.meta.url),
			"utf8",
		),
	);
	catalog.types[1].members[0].type = "System.Double";
	assert.throws(
		() => generate(catalog, "Example.Map"),
		/identity no longer matches/,
	);
});

test("real save Vector2 keys round-trip through the existing float/object codecs", async () => {
	const save = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	const fragment = save.match(
		/<key>\s*(<Vector2>[\s\S]*?<\/Vector2>)\s*<\/key>/,
	)?.[1];
	assert.ok(fragment);
	const tree = await parse(fragment);
	const key = await Effect.runPromise(Schema.decodeEffect(vector)(tree));
	assert.equal(typeof key.value.X, "number");
	assert.equal(typeof key.value.Y, "number");
	assert.deepEqual(
		await Effect.runPromise(Schema.encodeEffect(vector)(key)),
		tree,
	);
});
