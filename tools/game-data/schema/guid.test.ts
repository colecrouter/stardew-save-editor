import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { FragmentXmlSchema } from "./tests/fixtures/guid.generated.ts";
import * as Xml from "./xml-codecs.ts";

const decode = Schema.decodeSync(Xml.Guid);
const encode = Schema.encodeSync(Xml.Guid);
const mixed = "FF46EAA0-A819-4C7E-B09F-8BBD2442209F";
const zero = "00000000-0000-0000-0000-000000000000";
const arbitrary = "ffffffff-ffff-ffff-ffff-ffffffffffff";

test("Guid validates hex groups and produces a nominal canonical string", () => {
	const id: Xml.Guid = decode(mixed);
	const text: string = id;
	type IsBranded = string extends Xml.Guid ? false : true;
	const branded: IsBranded = true;
	assert.equal(branded, true);
	assert.equal(text, mixed.toLowerCase());
	assert.equal(encode(id), mixed.toLowerCase());
	// GUIDs are not restricted to UUID version/variant combinations.
	assert.equal(decode(zero), zero);
	assert.equal(decode(arbitrary), arbitrary);
	assert.equal(encode(decode(arbitrary.toUpperCase())), arbitrary);
});

test("Guid rejects template-shaped strings and malformed hexadecimal values", () => {
	for (const text of [
		"a-b-c-d-e",
		"",
		" ",
		"ff46eaa0-a819-4c7e-b09f-8bbd2442209g",
		"ff46eaa-a819-4c7e-b09f-8bbd2442209f",
		"ff46eaa0a8194c7eb09f8bbd2442209f",
		`{${mixed}}`,
		` ${mixed} `,
		`${mixed}\n`,
	]) {
		assert.throws(() => decode(text), text);
		assert.throws(() => Schema.encodeUnknownSync(Xml.Guid)(text), text);
	}
});

test("generated Guid fields preserve imported case while edited values use canonical text", async () => {
	const xml = `<Building xmlns:i="http://www.w3.org/2001/XMLSchema-instance" owner="${arbitrary.toUpperCase()}"><id mod="id">${mixed}<!-- keep --></id><ids><guid>${mixed}</guid><future>keep</future></ids><optional i:nil="1"/><unknown>keep</unknown></Building>`;
	const read = Schema.decodeEffect(FragmentXmlSchema);
	const write = Schema.encodeEffect(FragmentXmlSchema);
	const data = await Effect.runPromise(read(xml));
	const id: Xml.Guid = data.value.id;
	const ids: readonly Xml.Guid[] = data.value.ids;
	const optional: Xml.Guid | null = data.value.optional;
	assert.equal(id, mixed.toLowerCase());
	assert.equal(ids[0], id);
	assert.equal(optional, null);
	const parse = (source: string) =>
		Effect.runPromise(Xml.parseFragment(source));
	assert.deepEqual(
		await parse(await Effect.runPromise(write(data))),
		await parse(xml),
	);
	const output = await Effect.runPromise(
		write({
			...data,
			value: {
				...data.value,
				id: decode(zero),
				optional: decode(arbitrary),
				ids: [...data.value.ids, decode(zero)],
			},
		}),
	);
	assert.match(output, new RegExp(`<id mod="id">${zero}<!-- keep --></id>`));
	assert.match(
		output,
		new RegExp(
			`<guid>${mixed}</guid><guid>${zero}</guid><future>keep</future>`,
		),
	);
	assert.match(output, new RegExp(`<optional>${arbitrary}</optional>`));
	assert.match(output, new RegExp(`owner="${arbitrary.toUpperCase()}"`));
});

test("Guid key identity ignores hex case and nullable Guid composes directly", async () => {
	const dictionary = Xml.fromXml(
		Xml.dictionary("guid", Xml.Guid, "string", Schema.String, false),
	);
	const entry = (key: string) =>
		`<item><key><guid>${key}</guid></key><value><string>value</string></value></item>`;
	await assert.rejects(
		Effect.runPromise(
			Schema.decodeEffect(dictionary)(
				`<dictionary>${entry(mixed)}${entry(mixed.toLowerCase())}</dictionary>`,
			),
		),
		/Duplicate dictionary key/,
	);
	const schema = Xml.fromXml(
		Xml.structure({ id: Xml.field("id", Xml.nullable(Xml.Guid)) }),
	);
	const data = await Effect.runPromise(
		Schema.decodeEffect(schema)(
			'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><id i:nil="true"/></Root>',
		),
	);
	assert.equal(data.value.id, null);
	const output = await Effect.runPromise(
		Schema.encodeEffect(schema)({ ...data, value: { id: decode(mixed) } }),
	);
	assert.match(output, new RegExp(`<id>${mixed.toLowerCase()}</id>`));
});

test("a real save building GUID decodes through the registered codec", async () => {
	const save = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	const id = save.match(/<id>([0-9a-fA-F-]{36})<\/id>/)?.[1];
	assert.ok(id);
	assert.equal(encode(decode(id)), id.toLowerCase());
});
