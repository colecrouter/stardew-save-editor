import { Effect, Schema, SchemaParser } from "effect";
import { scalarTypes } from "./scalars.ts";
import type { ScalarType } from "./scalars.ts";
import {
	attach,
	accepted,
	instanceAttribute,
	noAttributes,
	rejectContent,
	whitespace,
	without,
	xsi,
	invalid,
} from "./events.ts";
import type { Codec, Frame } from "./events.ts";
export { record, xsi } from "./events.ts";
export type { Codec } from "./events.ts";

export function text<A>(codec: Schema.Codec<A, string>): Codec<A> {
	// Each text codec owns one lexical conversion pair, reused by all its frames.
	// The reader already reports SchemaIssue.Issue, so use the public parser API
	// directly instead of wrapping each failure as SchemaError and unwrapping it.
	const decodeText = SchemaParser.decodeUnknownEffect(codec);
	const encodeText = Schema.encodeSync(codec);
	return Object.assign(
		attach(
			Schema.toType(codec),
			(header) =>
				Effect.gen(function* () {
					yield* noAttributes(header);
					let text = "";
					return {
						text: (value) =>
							Effect.sync(() => {
								text += value;
							}),
						child: rejectContent,
						finish: () => decodeText(text),
					} satisfies Frame;
				}),
			function* (name, value, attributes) {
				yield { _tag: "StartElement", name, attributes };
				yield { _tag: "Text", text: encodeText(value) };
				yield { _tag: "EndElement", name };
			},
		),
		{ text: codec },
	);
}
export function scalar<K extends ScalarType>(
	id: K,
): Codec<(typeof scalarTypes)[K]["codec"]["Type"]> {
	// The scalar registry is the only lexical conversion table. Event handling
	// supplies text without guessing whether a numeric-looking value is a string.
	return text(
		scalarTypes[id].codec as Schema.Codec<
			(typeof scalarTypes)[K]["codec"]["Type"],
			string
		>,
	);
}
export function nullable<A>(codec: Codec<A>): Codec<A | null> {
	return attach(
		Schema.NullOr(Schema.toType(codec)),
		(header) =>
			Effect.gen(function* () {
				const attribute = yield* instanceAttribute(header, "nil");
				const nil = attribute ? header.attributes[attribute] : undefined;
				const clean = without(header, attribute);
				if (nil !== undefined && !["true", "1", "false", "0"].includes(nil))
					return yield* invalid("Invalid xsi:nil");
				if (nil === "true" || nil === "1") {
					yield* noAttributes(clean);
					const invalidContent = () => invalid("Nil element contains data");
					return {
						text: (value) => (value.trim() ? invalidContent() : Effect.void),
						child: invalidContent,
						finish: () => Effect.succeed(null),
					} satisfies Frame;
				}
				return yield* codec.open(clean);
			}),
		function* (name, value, attributes) {
			if (value !== null) {
				yield* codec.write(name, value, attributes);
				return;
			}
			yield {
				_tag: "StartElement",
				name,
				attributes: { ...attributes, "xmlns:xsi": xsi, "xsi:nil": "true" },
			};
			yield { _tag: "EndElement", name };
		},
	);
}
function arraySchema<A>(codec: Codec<A>, maxItems?: number) {
	const schema = Schema.Array(Schema.toType(codec));
	return maxItems === undefined
		? schema
		: schema.check(Schema.isMaxLength(maxItems));
}
export function sequence<A>(
	codec: Codec<A>,
	maxItems?: number,
): Codec<readonly A[]> {
	// Repetitions have no enclosing element. Their owner selects each item codec
	// and validates the completed array when the containing object closes.
	return Object.assign(
		attach(
			arraySchema(codec, maxItems),
			rejectContent,
			function* (name, values, attributes) {
				for (const value of values) yield* codec.write(name, value, attributes);
			},
		),
		{ item: codec },
	);
}
export function wrapped<A>(
	codec: Codec<A>,
	itemName: string,
	maxItems?: number,
): Codec<readonly A[]> {
	return attach(
		arraySchema(codec, maxItems),
		(header) =>
			Effect.gen(function* () {
				yield* noAttributes(header);
				const values: unknown[] = [];
				return {
					text: whitespace,
					child: (child) =>
						Effect.gen(function* () {
							if (maxItems !== undefined && values.length >= maxItems)
								return yield* invalid(
									`Collection allows at most ${maxItems} items`,
								);
							if (child.name !== itemName)
								return yield* invalid(
									`Unsupported collection item ${child.name}; expected ${itemName}`,
								);
							return accepted(yield* codec.open(child), (value) => {
								values.push(value);
							});
						}),
					finish: () => Effect.succeed(values),
				} satisfies Frame;
			}),
		function* (name, values, attributes) {
			yield { _tag: "StartElement", name, attributes };
			for (const value of values) yield* codec.write(itemName, value);
			yield { _tag: "EndElement", name };
		},
	);
}

// CLR NetField wrappers serialize zero or one child, but represent one logical
// value. Empty reference wrappers decode to null; present values need no array.
export function single<A>(codec: Codec<A>, itemName: string): Codec<A | null> {
	const sequence = wrapped(codec, itemName, 1);
	return attach(
		Schema.NullOr(Schema.toType(codec)),
		(header) =>
			Effect.gen(function* () {
				const frame = yield* sequence.open(header);
				return {
					...frame,
					finish: () =>
						Effect.map(
							frame.finish(),
							(value) => (value as readonly A[])[0] ?? null,
						),
				};
			}),
		(name, value, attributes) =>
			sequence.write(name, value === null ? [] : [value], attributes),
	);
}

/** An empty NetRef is represented by an omitted element, as XmlSerializer writes it. */
export function optionalReference<A>(codec: Codec<A>): Codec<A | null> {
	const value = nullable(codec);
	return Object.assign(
		attach(
			Schema.toType(value),
			value.open,
			function* (name, item, attributes) {
				if (item !== null) yield* codec.write(name, item, attributes);
			},
		),
		{ missingValue: null },
	);
}
