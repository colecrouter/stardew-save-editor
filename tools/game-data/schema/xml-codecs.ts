import * as Effect from "effect/Effect";
import { Xml } from "effect/encoding";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { scalarTypes } from "./mappings/scalars.ts";
import type { EncodedValue, Field } from "./runtime/fields.ts";
import { replaceField, selectField } from "./runtime/fields.ts";
import type { XmlElement } from "./runtime/xml-tree.ts";
import {
	assertPlainElement,
	parseFragment,
	printFragment,
	XmlElementSchema,
} from "./runtime/xml-tree.ts";

// Compatibility aliases for earlier generated modules; the actual codec and
// default XML item name are registered together in mappings/scalars.ts.
export { scalarTypes as scalars } from "./mappings/scalars.ts";
export { structures } from "./mappings/structures.ts";
export { optional } from "./mappings/structures.ts";
export { anyObject } from "./runtime/any-object.ts";
export type { ScalarObject } from "./runtime/any-object.ts";
// This is the stable runtime entry point imported by generated modules. Keep the
// public helpers here while tree mechanics and XML slot ownership live separately.
export { attribute, collection, element } from "./runtime/fields.ts";
export type { XmlElement, XmlNode } from "./runtime/xml-tree.ts";
export { parseFragment, printFragment } from "./runtime/xml-tree.ts";
export {
	String,
	Boolean,
	Byte,
	Int32,
	UInt32,
	Int64,
	UInt64,
	Single,
	Double,
	Guid,
	scalarValues,
} from "./runtime/scalar-values.ts";
export const BooleanText = scalarTypes["System.Boolean"].codec;

// Compose the saved-value view with its original tree. A plain Struct would
// discard unknown XML; the envelope lets encoding update only the fields we own.
export function object<const F extends Record<string, Field>>(
	name: string | undefined,
	fields: F,
	options: { readonly allowType?: boolean } = {},
) {
	// Object.fromEntries preserves exactly these keys; the mapped type keeps
	// generated field inference instead of widening every decoded value to unknown.
	const codecs = Object.fromEntries(
		Object.entries(fields).map(([key, field]) => [key, field.schema]),
	) as { [K in keyof F]: F[K]["schema"] };
	const valueSchema = Schema.Struct(codecs);
	// During decoding these field schemas receive XML text. During encoding
	// they produce canonical text before our reverse transformation patches XML.
	const target = Schema.Struct({
		value: valueSchema,
		original: XmlElementSchema,
	});
	const codec = XmlElementSchema.pipe(
		Schema.decodeTo(
			target,
			SchemaTransformation.transformEffect({
				// Project only named XML slots into .value; keep the entire tree in
				// .original so generated schemas don't need to model every saved node.
				decode: (original) =>
					Effect.try({
						try: () => {
							if (name !== undefined && original.name !== name)
								throw new Error(`Expected ${name}, found ${original.name}`);
							assertPlainElement(original, options.allowType ?? false);
							// The target Struct validates the projected encoded values, including
							// every field conversion. This assertion doesn't bypass that validation.
							const value = Object.fromEntries(
								Object.entries(fields).flatMap(([key, field]) => {
									const selected = selectField(original, field.binding);
									// Exact optional keys must be absent, not present with undefined.
									return selected === undefined ? [] : [[key, selected]];
								}),
							) as typeof valueSchema.Encoded;
							return { value, original };
						},
						catch: (error) =>
							new SchemaIssue.InvalidValue({ message: String(error) }),
					}),
				// Field schemas have encoded .value already. Compare those texts
				// semantically with the original before deciding which slots to patch.
				encode: ({ value, original }) =>
					Effect.gen(function* () {
						// Selection/patching can reject unsupported XML shapes. Keep those
						// expected failures in Schema's issue channel rather than as defects.
						const attempt = <A>(run: () => A) =>
							Effect.try({
								try: run,
								catch: (error) =>
									new SchemaIssue.InvalidValue({ message: String(error) }),
							});
						yield* attempt(() => {
							if (name !== undefined && original.name !== name)
								throw new Error(`Expected original ${name}`);
							assertPlainElement(original, options.allowType ?? false);
						});
						// Work from the original tree without mutating the imported envelope;
						// untouched fields and unknown siblings therefore retain their nodes.
						let edited: XmlElement = original;
						for (const [key, field] of Object.entries(fields)) {
							// Missing keys must not read inherited names such as toString or
							// __proto__ as saved values when optional members are absent.
							const next = Object.hasOwn(value, key)
								? (value as Record<string, EncodedValue>)[key]
								: undefined;
							if (next === undefined && !field.binding.optional)
								return yield* Effect.fail(
									new SchemaIssue.InvalidValue({
										message: `Missing encoded field ${key}`,
									}),
								);
							const previous = yield* attempt(() =>
								selectField(original, field.binding),
							);
							// Presence changes bypass value comparison: an absent slot has no
							// scalar/object value to decode. Both absent means no XML edit.
							if (previous === undefined || next === undefined) {
								if (previous !== next)
									edited = yield* attempt(() =>
										replaceField(edited, field.binding, next),
									);
								continue;
							}
							// Field codecs own comparisons too: retain original text
							// when decoded values agree, without duplicating conversions.
							const decodeField = Schema.decodeEffect(field.schema);
							const previousValue = yield* decodeField(previous).pipe(
								Effect.mapError(
									(error) =>
										new SchemaIssue.Pointer(["value", key], error.issue),
								),
							);
							const nextValue = yield* decodeField(next).pipe(
								Effect.mapError(
									(error) =>
										new SchemaIssue.Pointer(["value", key], error.issue),
								),
							);
							// Let the schema compare typed values (including nested envelopes)
							// rather than relying on JSON's limited set of scalar values.
							const equivalent = Schema.toEquivalence(
								Schema.toType(field.schema),
							);
							if (!equivalent(previousValue, nextValue))
								edited = yield* attempt(() =>
									replaceField(edited, field.binding, next),
								);
						}
						return edited;
					}),
			}),
		),
	);
	// Variant wrappers reuse the decoded value schema without re-decoding XML text.
	return Object.assign(codec, { valueSchema: Schema.toType(valueSchema) });
}

// Nested objects are reusable across element names. Their owning binding checks
// the name; this codec retains the child's original tree and validates its fields.
export function structure<const F extends Record<string, Field>>(
	fields: F,
	options: { readonly allowType?: boolean } = {},
) {
	return object(undefined, fields, options);
}

// Compose XML text parsing with the generated tree codec, so consumers use the
// normal Effect Schema decode/encode APIs for the entire round trip.
export function fromXml<S extends Schema.ConstraintCodec<unknown, XmlElement>>(
	schema: S,
) {
	// Only this boundary converts XML syntax failures into schema issues. The
	// tree codec below can then be tested without any text parser involved.
	const tree = Schema.String.pipe(
		Schema.decodeTo(
			XmlElementSchema,
			SchemaTransformation.transformEffect({
				decode: (xml) =>
					parseFragment(xml).pipe(
						Effect.mapError((error) =>
							Xml.isXmlError(error)
								? new SchemaIssue.InvalidValue({ message: error.message })
								: error,
						),
					),
				encode: (element) =>
					printFragment(element).pipe(
						Effect.mapError(
							(error) =>
								new SchemaIssue.InvalidValue({ message: error.message }),
						),
					),
			}),
		),
	);
	return tree.pipe(Schema.decodeTo(schema));
}

export { named, variant } from "./runtime/polymorphism.ts";

export { dictionary } from "./runtime/dictionary.ts";
export { nullableEnumText } from "./runtime/enum-text.ts";
export { inventory } from "./runtime/inventory.ts";

export { value, nullable, textValue, enumeration } from "./runtime/values.ts";
export type { XmlValue, TextValue } from "./runtime/values.ts";
export { field, list, repeatedValues } from "./mappings/structures.ts";

export { keyIdentities } from "./mappings/key-identities.ts";
export { array } from "./runtime/array.ts";
