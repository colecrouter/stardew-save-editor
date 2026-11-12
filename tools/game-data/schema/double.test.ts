import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import * as Xml from "./xml-codecs.ts";
import { FragmentXmlSchema } from "./tests/fixtures/double.generated.ts";

const decode = Schema.decodeSync(Xml.Double);
const encode = Schema.encodeSync(Xml.Double);

test("Double retains binary64 precision, range, subnormals and signed zero", () => {
	assert.equal(decode("0.1"), 0.1);
	assert.notEqual(decode("0.1"), Math.fround(0.1));
	assert.equal(decode("16777217"), 16777217);
	assert.equal(decode(" \t+1.25e2\r\n"), 125);
	assert.equal(decode(".5"), 0.5);
	assert.equal(decode("1."), 1);
	assert.equal(decode("1.7976931348623157e308"), Number.MAX_VALUE);
	assert.equal(decode("5e-324"), Number.MIN_VALUE);
	assert.equal(decode("1e-400"), 0);
	assert.ok(Object.is(decode("-1e-400"), -0));
	for (const value of [
		0.1,
		16777217,
		Number.MAX_VALUE,
		-Number.MAX_VALUE,
		Number.MIN_VALUE,
		-Number.MIN_VALUE,
		-0,
	])
		assert.ok(Object.is(decode(encode(value)), value));
});

test("Double uses XML special tokens and rejects invalid numbers and decimal overflow", () => {
	assert.equal(decode("INF"), Infinity);
	assert.equal(decode("-INF"), -Infinity);
	assert.ok(Number.isNaN(decode("NaN")));
	assert.equal(encode(Infinity), "INF");
	assert.equal(encode(-Infinity), "-INF");
	assert.equal(encode(NaN), "NaN");
	assert.equal(encode(-0), "-0");
	for (const text of [
		"",
		" ",
		"0xff",
		"1_000",
		"1,5",
		"Infinity",
		"+INF",
		"nan",
		"1e",
		"--1",
		"1e309",
		"-1.7976931348623159e308",
	])
		assert.throws(() => decode(text), text);
});

test("generated Double fields preserve source text and compose with nullable and collection bindings", async () => {
	const xml =
		'<Luck xmlns:i="http://www.w3.org/2001/XMLSchema-instance" bias="-0"><dailyLuck>+0.010000e0</dailyLuck><history><double>0.1000</double><future>keep</future><double>NaN</double></history><optional i:nil="1" mod="keep"/><!-- keep --></Luck>';
	const read = Schema.decodeEffect(FragmentXmlSchema);
	const write = Schema.encodeEffect(FragmentXmlSchema);
	const data = await Effect.runPromise(read(xml));
	const luck: number = data.value.dailyLuck;
	const optional: number | null = data.value.optional;
	const history: readonly number[] = data.value.history;
	assert.equal(luck, 0.01);
	assert.equal(optional, null);
	assert.equal(history[0], 0.1);
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
				dailyLuck: 0.12345678901234568,
				bias: 0,
				optional: Number.MAX_VALUE,
			},
		}),
	);
	assert.match(output, /<dailyLuck>0.12345678901234568<\/dailyLuck>/);
	assert.match(output, /bias="0"/);
	assert.match(
		output,
		/<optional mod="keep">1.7976931348623157e\+308<\/optional>/,
	);
	assert.match(
		output,
		/<double>0.1000<\/double><future>keep<\/future><double>NaN<\/double>/,
	);
	assert.equal(
		(await Effect.runPromise(read(output))).value.optional,
		Number.MAX_VALUE,
	);
});

test("Xml.nullable composes directly with Xml.Double", async () => {
	const schema = Xml.fromXml(
		Xml.structure({ Luck: Xml.field("Luck", Xml.nullable(Xml.Double)) }),
	);
	const data = await Effect.runPromise(
		Schema.decodeEffect(schema)(
			'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><Luck i:nil="true"/></Root>',
		),
	);
	assert.equal(data.value.Luck, null);
	const output = await Effect.runPromise(
		Schema.encodeEffect(schema)({ ...data, value: { Luck: 0.1 } }),
	);
	assert.match(output, /<Luck>0.1<\/Luck>/);
});
