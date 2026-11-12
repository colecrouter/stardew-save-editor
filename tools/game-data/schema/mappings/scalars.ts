import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

// Single and Double share XML syntax, special-value tokens and preservation
// rules. Precision is the only difference: Single rounds to binary32, while
// Double already has the same binary64 representation as a JavaScript number.
function floatingPoint(
	name: "Single" | "Double",
	round: (value: number) => number,
) {
	const text = Schema.String.check(
		// Keep XML decimal/exponent syntax narrower than Number(), which also accepts
		// hexadecimal and empty input. XML whitespace around a value is permitted.
		Schema.isPattern(
			/^[\t\n\r ]*(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|INF|-INF|NaN)[\t\n\r ]*$/,
		),
		Schema.makeFilter<string>((text) => {
			const token = text.trim();
			// Explicit infinities are valid. Reject decimal overflow so an ordinary
			// imported value cannot silently become infinite during numeric conversion.
			return ["INF", "-INF", "NaN"].includes(token) ||
				Number.isFinite(round(Number(token)))
				? undefined
				: `Decimal value overflows System.${name}`;
		}),
	);
	// Non-finite values are intentional CLR/XML float values. Number rather than
	// Finite admits their explicit tokens; the round check bounds edited Singles.
	const number = Schema.Number.check(
		Schema.makeFilter<number>((value) =>
			!Number.isFinite(value) || Number.isFinite(round(value))
				? undefined
				: `Number overflows System.${name}`,
		),
	).pipe(
		// Signed zero is observable float state. Two NaNs count as unchanged, so
		// both kinds of value retain their imported spelling on no-op export.
		Schema.overrideToEquivalence(() => Object.is),
	);
	return text.pipe(
		Schema.decodeTo(
			number,
			SchemaTransformation.transform({
				decode: (text) => {
					const token = text.trim();
					if (token === "INF") return Infinity;
					if (token === "-INF") return -Infinity;
					if (token === "NaN") return NaN;
					// Apply the declared precision, including subnormals and signed underflow.
					return round(Number(token));
				},
				encode: (value) => {
					const rounded = round(value);
					// JS uses other infinity spellings and String(-0) loses the sign. Finite
					// text only needs to round-trip; unchanged source text is preserved by fields.
					if (Number.isNaN(rounded)) return "NaN";
					if (rounded === Infinity) return "INF";
					if (rounded === -Infinity) return "-INF";
					return Object.is(rounded, -0) ? "-0" : String(rounded);
				},
			}),
		),
	);
}
const single = floatingPoint("Single", Math.fround);
const double = floatingPoint("Double", (value) => value);

// XmlSerializer writes GUIDs in the hyphenated D format. Accept either hex case
// on import, but expose a canonical lowercase identity with a nominal brand.
// This checks all hexadecimal groups without imposing UUID version/variant bits;
// .NET Guid.Empty and arbitrary 128-bit GUID values are valid.
const guidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const guid = Schema.String.check(
	Schema.isPattern(new RegExp(guidPattern.source, "i")),
).pipe(
	Schema.decodeTo(
		Schema.String.check(Schema.isPattern(guidPattern)).pipe(
			Schema.brand("System.Guid"),
		),
		SchemaTransformation.transform({
			decode: (text) => text.toLowerCase(),
			encode: (value) => value,
		}),
	),
);

// Register CLR scalar support here: its text codec and XmlSerializer's default
// collection item name belong together. Compiler and generated runtime code both
// use this table, so adding a type doesn't require an emitter case as well.
export const scalarTypes = {
	"System.String": { xmlItemName: "string", codec: Schema.String },
	"System.Guid": {
		xmlItemName: "guid",
		xmlTypeNamespace: "http://microsoft.com/wsdl/types/",
		codec: guid,
	},
	"System.Single": { xmlItemName: "float", codec: single },
	"System.Double": { xmlItemName: "double", codec: double },
	"System.Byte": {
		xmlItemName: "unsignedByte",
		// CLR Byte is an unsigned integer. Validate decimal text before conversion,
		// then enforce its full 0–255 range in both decode and encode directions.
		codec: Schema.String.check(Schema.isPattern(/^[+-]?\d+$/)).pipe(
			Schema.decodeTo(Schema.FiniteFromString),
			Schema.check(
				Schema.isInt(),
				Schema.isGreaterThanOrEqualTo(0),
				Schema.isLessThanOrEqualTo(255),
			),
		),
	},
	"System.Int32": {
		xmlItemName: "int",
		// Decimal syntax and CLR bounds prevent JavaScript's number conversion
		// from accepting fractions, alternate bases, or overflowing saved values.
		codec: Schema.String.check(Schema.isPattern(/^[+-]?\d+$/)).pipe(
			Schema.decodeTo(Schema.FiniteFromString),
			Schema.check(
				Schema.isInt(),
				Schema.isGreaterThanOrEqualTo(-2147483648),
				Schema.isLessThanOrEqualTo(2147483647),
			),
		),
	},
	"System.UInt32": {
		xmlItemName: "unsignedInt",
		codec: Schema.String.check(Schema.isPattern(/^[+-]?\d+$/)).pipe(
			Schema.decodeTo(Schema.FiniteFromString),
			Schema.check(
				Schema.isInt(),
				Schema.isGreaterThanOrEqualTo(0),
				Schema.isLessThanOrEqualTo(4294967295),
			),
		),
	},
	"System.Int64": {
		xmlItemName: "long",
		// Save identifiers can exceed Number.MAX_SAFE_INTEGER. Keep the full
		// signed 64-bit value as bigint rather than silently rounding it.
		codec: Schema.BigIntFromString.check(
			Schema.isGreaterThanOrEqualToBigInt(-9223372036854775808n),
			Schema.isLessThanOrEqualToBigInt(9223372036854775807n),
		),
	},
	"System.UInt64": {
		xmlItemName: "unsignedLong",
		codec: Schema.BigIntFromString.check(
			Schema.isGreaterThanOrEqualToBigInt(0n),
			Schema.isLessThanOrEqualToBigInt(18446744073709551615n),
		),
	},
	"System.Boolean": {
		xmlItemName: "boolean",
		// Accept both XML boolean spellings; encode changed values canonically.
		codec: Schema.Literals(["true", "false", "1", "0"]).pipe(
			Schema.decodeTo(
				Schema.Boolean,
				SchemaTransformation.transform({
					decode: (value) => value === "true" || value === "1",
					encode: (value) => (value ? "true" : "false"),
				}),
			),
		),
	},
} as const;

export type ScalarType = keyof typeof scalarTypes;
export function scalarXmlType(id: ScalarType) {
	const scalar = scalarTypes[id];
	// Built-in scalar type names match their collection item names. Guid is a
	// .NET XML extension; keep that exception beside its codec registration.
	return {
		name: scalar.xmlItemName,
		namespace:
			"xmlTypeNamespace" in scalar
				? scalar.xmlTypeNamespace
				: "http://www.w3.org/2001/XMLSchema",
	};
}
export function isScalarType(id: string): id is ScalarType {
	// CLR names are arbitrary input strings, not inherited JavaScript keys.
	return Object.hasOwn(scalarTypes, id);
}
