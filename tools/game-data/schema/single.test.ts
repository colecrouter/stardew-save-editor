import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { scalarTypes } from "./mappings/scalars.ts";
import { FragmentXmlSchema } from "./tests/fixtures/single.generated.ts";
import { parseFragment } from "./xml-codecs.ts";

const codec = scalarTypes["System.Single"].codec;
const decode = Schema.decodeSync(codec);
const encode = Schema.encodeSync(codec);

test("Single decodes decimal and exponent values to binary32", () => {
	assert.equal(decode("0.1"), Math.fround(0.1));
	assert.equal(decode(" \t+1.25e2\r\n"), 125);
	assert.equal(decode(".5"), 0.5);
	assert.equal(decode("1."), 1);
	assert.equal(decode("16777217"), 16777216);
	assert.equal(decode("3.4028235e38"), Math.fround(3.4028235e38));
	assert.equal(decode("1.401298464324817e-45"), 2 ** -149);
	assert.equal(decode("1e-50"), 0);
	assert.ok(Object.is(decode("-1e-50"), -0));
});

test("Single encodes edited JS numbers at binary32 precision", () => {
	for (const value of [0.1, 1.25, -12.5, 2 ** -149, 3.4028235e38, 1e-50, -0])
		assert.ok(Object.is(decode(encode(value)), Math.fround(value)));
	assert.equal(encode(16777217), "16777216");
	assert.equal(encode(-0), "-0");
});

test("Single supports XML special values and rejects accidental decimal overflow", () => {
	assert.equal(decode("INF"), Infinity);
	assert.equal(decode("-INF"), -Infinity);
	assert.ok(Number.isNaN(decode("NaN")));
	assert.equal(encode(Infinity), "INF");
	assert.equal(encode(-Infinity), "-INF");
	assert.equal(encode(NaN), "NaN");
	for (const text of [
		"",
		" ",
		"0x10",
		"1_000",
		"1,5",
		"Infinity",
		"+INF",
		"nan",
		"1e",
		"--1",
		"1e100",
		"-3.5e38",
	])
		assert.throws(() => decode(text), text);
	assert.throws(() => encode(1e100), /overflows/);
});

test("generated Single fields preserve original spellings and unrelated XML", async () => {
	const xml =
		'<Fence Bias="-0"><Health>001.2500e+2</Health><History><float>0.10</float><future>keep</future><float>NaN</float></History><!-- keep --><unknown>keep</unknown></Fence>';
	const read = Schema.decodeEffect(FragmentXmlSchema);
	const write = Schema.encodeEffect(FragmentXmlSchema);
	const fence = await Effect.runPromise(read(xml));
	const health: number = fence.value.Health;
	const history: readonly number[] = fence.value.History;
	assert.equal(health, 125);
	assert.equal(history[0], Math.fround(0.1));
	const output = await Effect.runPromise(write(fence));
	assert.deepEqual(
		await Effect.runPromise(parseFragment(output)),
		await Effect.runPromise(parseFragment(xml)),
	);
	const edited = await Effect.runPromise(
		write({ ...fence, value: { ...fence.value, Health: 0.1 } }),
	);
	assert.match(edited, /<Health>0.10000000149011612<\/Health>/);
	assert.match(
		edited,
		/<float>0.10<\/float><future>keep<\/future><float>NaN<\/float>/,
	);
	assert.match(edited, /Bias="-0"/);
});

test("Single field comparison distinguishes signed zero edits", async () => {
	const xml = '<Fence Bias="-0"><Health>0</Health><History/></Fence>';
	const fence = await Effect.runPromise(
		Schema.decodeEffect(FragmentXmlSchema)(xml),
	);
	const output = await Effect.runPromise(
		Schema.encodeEffect(FragmentXmlSchema)({
			...fence,
			value: { ...fence.value, Bias: 0, Health: -0 },
		}),
	);
	assert.match(output, /Bias="0"/);
	assert.match(output, /<Health>-0<\/Health>/);
});
