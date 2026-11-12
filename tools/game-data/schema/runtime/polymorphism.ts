import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import type { XmlElement } from "./xml-tree.ts";
import { XmlElementSchema } from "./xml-tree.ts";
import type { XmlTypeName } from "./xml-types.ts";
import { readXmlType, sameXmlType, writeXmlType } from "./xml-types.ts";

type ObjectCodec = Schema.Codec<
	{ readonly value: unknown; readonly original: XmlElement },
	XmlElement
> & { readonly valueSchema: Schema.Codec<unknown> };
const attempt = <A>(run: () => A) =>
	Effect.try({
		try: run,
		catch: (error) => new SchemaIssue.InvalidValue({ message: String(error) }),
	});

export function variant<const Id extends string, S extends ObjectCodec>(
	id: Id,
	identity: XmlTypeName,
	schema: S,
	allowMissing: boolean,
) {
	// The object builder emits required fields; widening its codec to this
	// concrete view prevents generic optional-key markers leaking into the wrapper.
	const envelopeSchema: Schema.Codec<S["Type"], XmlElement> = schema;
	const valueSchema: Schema.Codec<S["valueSchema"]["Type"]> =
		schema.valueSchema;
	// Verify the XML discriminator before the field schema sees the element. Union
	// alternatives must never infer a derived type merely from which fields happen
	// to validate. Only the concrete declared base accepts a missing xsi:type.
	const wrapped = XmlElementSchema.pipe(
		Schema.decodeTo(
			Schema.Struct({ type: Schema.Literal(id), envelope: envelopeSchema }),
			SchemaTransformation.transformEffect({
				decode: (element) =>
					attempt(() => {
						const actual = readXmlType(element);
						if (actual ? !sameXmlType(actual, identity) : !allowMissing)
							throw new Error(
								`${element.name}: expected xsi:type {${identity.namespace}}${identity.name}`,
							);
						return { type: id, envelope: element };
					}),
				encode: ({ envelope }) =>
					attempt(() => writeXmlType(envelope, identity, allowMissing)),
			}),
		),
	);
	// Flatten the wrapper back to our usual envelope and add a literal CLR type
	// tag. Consumers get a discriminated union without a second .envelope layer.
	return wrapped.pipe(
		Schema.decodeTo(
			Schema.Struct({
				type: Schema.Literal(id),
				value: valueSchema,
				original: XmlElementSchema,
			}),
			SchemaTransformation.transform({
				decode: ({ type, envelope }) => ({
					type,
					value: envelope.value as S["valueSchema"]["Type"],
					original: envelope.original,
				}),
				encode: ({ type, value, original }) => ({
					type,
					envelope: { value, original } as S["Type"],
				}),
			}),
		),
	);
}

export function named<S extends Schema.ConstraintCodec<unknown, XmlElement>>(
	name: string,
	schema: S,
) {
	// Root element names and XML type names are different identities. Enforce the
	// former at the document boundary while reusable child codecs accept aliases.
	return XmlElementSchema.pipe(
		Schema.decodeTo(
			schema,
			SchemaTransformation.transformEffect({
				decode: (element) =>
					attempt(() => {
						if (element.name !== name)
							throw new Error(`Expected ${name}, found ${element.name}`);
						return element as S["Encoded"];
					}),
				encode: (element) =>
					attempt(() => {
						if (element.name !== name)
							throw new Error(`Expected root ${name}, found ${element.name}`);
						return element;
					}),
			}),
		),
	);
}
