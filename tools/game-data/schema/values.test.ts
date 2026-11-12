import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import * as Xml from "./xml-codecs.ts";
import { generate } from "./generate.ts";
import { FragmentXmlSchema } from "./tests/fixtures/nullable.generated.ts";

const publicSchema = Xml.fromXml(
	Xml.structure({
		count: Xml.field("count", Xml.nullable(Xml.UInt32)),
		state: Xml.field("state", Xml.nullable(Xml.enumeration(["Ready", "Old"]))),
		version: Xml.attribute("version", Xml.UInt32),
	}),
);
const decode = (source: string) =>
	Effect.runPromise(Schema.decodeEffect(publicSchema)(source));
const encode = (value: typeof publicSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(publicSchema)(value));
const parse = (source: string) => Effect.runPromise(Xml.parseFragment(source));

test("Xml.nullable composes directly with UInt32 and enum value definitions", async () => {
	const xml =
		'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance" version="0001"><count i:nil="1" mod="count"><!-- keep --></count><state>Ready</state><unknown>keep</unknown></Root>';
	const data = await decode(xml);
	const count: number | null = data.value.count;
	const state: "Ready" | "Old" | null = data.value.state;
	assert.equal(count, null);
	assert.equal(state, "Ready");
	assert.equal(data.value.version, 1);
	assert.deepEqual(await parse(await encode(data)), await parse(xml));
	// Named scalar definitions remain usable as text schemas for existing callers.
	assert.equal(Schema.decodeSync(Xml.UInt32)("4294967295"), 4294967295);
});

test("nullable scalar transitions retain attributes, comments and namespace bindings", async () => {
	const xml =
		'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance" version="1"><count i:nil="true" mod="count"><!-- keep --></count><state>Ready</state><unknown>keep</unknown></Root>';
	const original = await decode(xml);
	const filled = await encode({
		...original,
		value: { ...original.value, count: 4294967295 },
	});
	assert.match(filled, /<count mod="count"><!-- keep -->4294967295<\/count>/);
	assert.match(filled, /<unknown>keep<\/unknown>/);
	const data = await decode(filled);
	const cleared = await encode({
		...data,
		value: { ...data.value, count: null },
	});
	assert.equal((await decode(cleared)).value.count, null);
	assert.match(cleared, /mod="count"/);
	assert.match(cleared, /<!-- keep -->/);
	const falseNil = xml
		.replace('i:nil="true"', 'i:nil="0"')
		.replace("<!-- keep -->", "0007<!-- keep -->");
	const withValue = await decode(falseNil);
	assert.equal(withValue.value.count, 7);
	assert.deepEqual(await parse(await encode(withValue)), await parse(falseNil));
	const edited = await encode({
		...withValue,
		value: { ...withValue.value, count: 8 },
	});
	assert.match(edited, /i:nil="0"/);
	assert.equal((await decode(edited)).value.count, 8);
});

test("nullable definitions enforce underlying domains and keep presence separate", async () => {
	const xml =
		'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance" version="1"><count>1</count><state>Ready</state></Root>';
	for (const text of ["-1", "4294967296", "1.5", "Unknown", ""])
		await assert.rejects(
			decode(xml.replace("<count>1</count>", `<count>${text}</count>`)),
		);
	await assert.rejects(
		decode(xml.replace("<state>Ready</state>", "<state>Unknown</state>")),
	);
	await assert.rejects(decode(xml.replace("<count>1</count>", "")));
	await assert.rejects(
		decode(xml.replace("<count>1</count>", '<count i:nil="true">1</count>')),
	);
	await assert.rejects(
		decode(xml.replace("<count>1</count>", '<count i:nil="maybe"/>')),
	);
	const data = await decode(xml);
	await assert.rejects(
		encode({ ...data, value: { ...data.value, count: 4294967296 } }),
	);
	assert.throws(() => {
		// @ts-expect-error Nullable values have no text capability for attributes.
		Xml.attribute("nullable", Xml.nullable(Xml.UInt32));
	}, /cannot bind to attributes/);
});

test("the nullable wrapper also composes with object codecs", async () => {
	const child = Xml.structure({ Name: Xml.field("Name", Xml.String) });
	const schema = Xml.fromXml(
		Xml.structure({ Child: Xml.field("Child", Xml.nullable(child)) }),
	);
	const source =
		'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><Child i:nil="true"/></Root>';
	const empty = await Effect.runPromise(Schema.decodeEffect(schema)(source));
	assert.equal(empty.value.Child, null);
	const sourceChild = await Effect.runPromise(
		Schema.decodeEffect(child)(
			await parse(
				'<Child mod="child"><Name>Ada</Name><future>keep</future></Child>',
			),
		),
	);
	const output = await Effect.runPromise(
		Schema.encodeEffect(schema)({ ...empty, value: { Child: sourceChild } }),
	);
	assert.equal(
		(await Effect.runPromise(Schema.decodeEffect(schema)(output))).value.Child
			?.value.Name,
		"Ada",
	);
	assert.match(output, /<future>keep<\/future>/);
});

test("generated Nullable scalar/enum fields and lists preserve XML while remaining typed", async () => {
	const xml =
		'<Nullable xmlns:i="http://www.w3.org/2001/XMLSchema-instance" version="0001"><which>0012</which><count i:nil="true"/><state>saved-old</state><history><int>0003</int><int i:nil="1" mod="empty"/><!-- list --></history></Nullable>';
	const read = Schema.decodeEffect(FragmentXmlSchema);
	const write = Schema.encodeEffect(FragmentXmlSchema);
	const data = await Effect.runPromise(read(xml));
	const which: number | null = data.value.which;
	const history: readonly (number | null)[] = data.value.history;
	const state: "Ready" | "saved-old" | null = data.value.state;
	assert.equal(which, 12);
	assert.deepEqual(history, [3, null]);
	assert.equal(state, "saved-old");
	assert.deepEqual(
		await parse(await Effect.runPromise(write(data))),
		await parse(xml),
	);
	const edited = await Effect.runPromise(
		write({
			...data,
			value: { ...data.value, which: null, history: [3, 7, null] },
		}),
	);
	const decoded = await Effect.runPromise(read(edited));
	assert.equal(decoded.value.which, null);
	assert.deepEqual(decoded.value.history, [3, 7, null]);
	assert.match(edited, /<int>0003<\/int>/);
	assert.match(edited, /mod="empty">7<\/int>/);
});

test("nullable generation rejects invalid type metadata and nullable attribute mappings", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/nullable.catalog.json", import.meta.url),
			"utf8",
		),
	);
	assert.match(generate(catalog, "Example.Nullable"), /Xml.nullable\(/);
	const invalid = structuredClone(catalog);
	invalid.types[1].genericArguments = [];
	assert.throws(() => generate(invalid, "Example.Nullable"), /reinspect/);

	const cycle = structuredClone(catalog);
	cycle.types[1].genericArguments = [cycle.types[1].id];
	assert.throws(() => generate(cycle, "Example.Nullable"), /nested nullable/);
	const attribute = structuredClone(catalog);
	attribute.types[0].members[0].attributes = [
		{ type: "System.Xml.Serialization.XmlAttributeAttribute" },
	];
	assert.throws(
		() => generate(attribute, "Example.Nullable"),
		/cannot be XML attributes/,
	);
});
