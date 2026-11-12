import { Effect, Schema } from "effect";
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
	decodeValue,
} from "./events.ts";
import type { Codec, Frame } from "./events.ts";
export { record, xsi } from "./events.ts";
export type { Codec } from "./events.ts";

export function text<A>(codec: Schema.Codec<A, string>): Codec<A> {
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
						finish: () => decodeValue(codec, text),
					} satisfies Frame;
				}),
			function* (name, value, attributes) {
				yield { _tag: "StartElement", name, attributes };
				yield { _tag: "Text", text: Schema.encodeSync(codec)(value) };
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
				yield* codec.events(name, value, attributes);
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
				for (const value of values)
					yield* codec.events(name, value, attributes);
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
			for (const value of values) yield* codec.events(itemName, value);
			yield { _tag: "EndElement", name };
		},
	);
}
