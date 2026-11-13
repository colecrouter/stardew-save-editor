import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "effect";
import * as Xml from "../../../src/lib/save-format/index.ts";
import { scalarTypes } from "../../../src/lib/save-format/scalars.ts";
import type { ScalarType } from "../../../src/lib/save-format/scalars.ts";
import { ordinalIgnoreCaseKey } from "../../../src/lib/save-format/ordinal-ignore-case.ts";
import { XmlSchema as ObjectSchema } from "./generated/any-object.ts";
import { XmlSchema as NullableEnumSchema } from "./generated/nullable-enum.ts";

test("scalar conversions retain CLR bounds and precision in both directions", () => {
	const cases: Array<[ScalarType, string, unknown, string[]]> = [
		["System.String", "007", "007", []],
		["System.Boolean", "1", true, ["yes", "2"]],
		["System.Byte", "255", 255, ["-1", "256", "1.5"]],
		["System.Int32", "-2147483648", -2147483648, ["2147483648", "0x10", "1.5"]],
		["System.UInt32", "4294967295", 4294967295, ["4294967296", "-1"]],
		[
			"System.Int64",
			"9007199254740993",
			9007199254740993n,
			["9223372036854775808", "1.5"],
		],
		[
			"System.UInt64",
			"18446744073709551615",
			18446744073709551615n,
			["-1", "18446744073709551616"],
		],
		["System.Single", "0.1", Math.fround(0.1), ["3.5e38", "garbage"]],
		[
			"System.Double",
			"1.7976931348623157e308",
			Number.MAX_VALUE,
			["1e309", ""],
		],
		[
			"System.Guid",
			"ABCDEF12-3456-0000-0000-000000000000",
			"abcdef12-3456-0000-0000-000000000000",
			["not-a-guid"],
		],
	];
	assert.equal(cases.length, Object.keys(scalarTypes).length);
	for (const [id, text, value, invalid] of cases) {
		const codec = scalarTypes[id].codec;
		assert.equal(Schema.decodeSync(codec)(text), value, id);
		const typed = Schema.decodeUnknownSync(Schema.toType(codec))(value);
		assert.equal(
			Schema.decodeSync(codec)(Schema.encodeSync(codec)(typed)),
			value,
			id,
		);
		for (const text of invalid)
			assert.throws(() => Schema.decodeSync(codec)(text), `${id}: ${text}`);
	}
	assert.throws(() => Schema.encodeSync(scalarTypes["System.Byte"].codec)(256));
	assert.throws(() =>
		Schema.encodeSync(scalarTypes["System.Int64"].codec)(9223372036854775808n),
	);
});

test("floating point special values, signed zero and underflow follow the CLR value domain", () => {
	for (const id of ["System.Single", "System.Double"] as const) {
		const codec = scalarTypes[id].codec;
		for (const value of [Infinity, -Infinity, NaN, -0])
			assert.ok(
				Object.is(
					Schema.decodeSync(codec)(Schema.encodeSync(codec)(value)),
					value,
				),
			);
	}
	assert.equal(
		Schema.decodeSync(scalarTypes["System.Single"].codec)("1e-50"),
		0,
	);
});

test("System.Object dispatch handles boxed scalars and nested objects without source envelopes", () => {
	const value = Schema.decodeSync(ObjectSchema)(
		'<DescriptionElement xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:x="http://www.w3.org/2001/XMLSchema"><xmlKey>hello</xmlKey><param i:type="x:int">7</param></DescriptionElement>',
	);
	assert.equal(value.param?.[0]?.$type, "System.Int32");
	const changed = {
		...value,
		param: [
			{ $type: "System.Int64" as const, value: 9007199254740993n },
			{ $type: "System.String" as const, value: "new" },
		],
	};
	const decoded = Schema.decodeSync(ObjectSchema)(
		Schema.encodeSync(ObjectSchema)(changed),
	);
	assert.deepEqual(decoded.param, changed.param);
});

test("nullable enum wrappers distinguish missing, empty and named text", () => {
	const schema = NullableEnumSchema;
	// Use the generated root/member names from this fixture's actual contract.
	const missing = Schema.decodeSync(schema)("<Preserve/>");
	const encoded = Schema.encodeSync(schema)(missing);
	assert.deepEqual(Schema.decodeSync(schema)(encoded), missing);
	assert.equal(missing.preserve, undefined);
	assert.deepEqual(
		Schema.decodeSync(schema)("<Preserve><preserve/></Preserve>").preserve,
		null,
	);
});

test("case-insensitive keys use ordinal folding, and structured keys use CLR field equality", () => {
	assert.equal(ordinalIgnoreCaseKey("Hello"), ordinalIgnoreCaseKey("HELLO"));
	const point = Xml.object({
		X: { xmlName: "X", codec: Xml.scalar("System.Single") },
		Y: { xmlName: "Y", codec: Xml.scalar("System.Single") },
	});
	const dictionary = Xml.dictionary(
		point,
		"Vector2",
		Xml.scalar("System.String"),
		"string",
		"Microsoft.Xna.Framework.Vector2",
	);
	assert.throws(() =>
		Schema.encodeSync(dictionary)([
			{ key: { X: 0, Y: 1 }, value: "a" },
			{ key: { X: -0, Y: 1 }, value: "b" },
		]),
	);
	// MonoGame compares float components with ==, so NaN coordinates stay distinct.
	assert.doesNotThrow(() =>
		Schema.encodeSync(dictionary)([
			{ key: { X: NaN, Y: 1 }, value: "a" },
			{ key: { X: NaN, Y: 1 }, value: "b" },
		]),
	);
});
