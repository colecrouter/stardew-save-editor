import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { scalarTypes, scalarXmlType } from "../mappings/scalars.ts";
import type { ScalarType } from "../mappings/scalars.ts";
import { scalarValues } from "./scalar-values.ts";
import type { XmlElement } from "./xml-tree.ts";
import { XmlElementSchema } from "./xml-tree.ts";
import {
	readXmlType,
	sameXmlType,
	typeAttribute,
	writeXmlType,
} from "./xml-types.ts";

// CLR tags preserve the distinction between numerically identical boxed values
// (for example Int32 and Double) and give callers a discriminated scalar union.
export type ScalarObject = {
	[K in ScalarType]: {
		readonly type: K;
		readonly value: (typeof scalarTypes)[K]["codec"]["Type"];
		readonly original: XmlElement;
	};
}[ScalarType];
const attempt = <A>(run: () => A) =>
	Effect.try({
		try: run,
		catch: (error) => new SchemaIssue.InvalidValue({ message: String(error) }),
	});
function scalarVariant(id: ScalarType) {
	const definition = scalarValues[id];
	const identity = scalarXmlType(id);
	const payload: Schema.Codec<unknown, XmlElement> = definition.element;
	function clean(original: XmlElement): XmlElement {
		// Validate the expanded QName before removing only the recognized type
		// attribute. Existing scalar codecs retain their strict nil/content checks.
		const actual = readXmlType(original);
		if (!actual || !sameXmlType(actual, identity))
			throw new Error(
				`${original.name}: expected xsi:type {${identity.namespace}}${identity.name}`,
			);
		const attributes = { ...original.attributes };
		const attribute = typeAttribute(original);
		if (attribute) delete attributes[attribute];
		return { ...original, attributes };
	}
	return XmlElementSchema.pipe(
		Schema.decodeTo(
			Schema.Struct({
				type: Schema.Literal(id),
				value: Schema.toType(payload),
				original: XmlElementSchema,
			}),
			SchemaTransformation.transformEffect({
				decode: (original) =>
					attempt(() => ({
						type: id,
						value: Schema.decodeSync(payload)(clean(original)),
						original,
					})),
				encode: ({ value, original }) =>
					attempt(() => {
						// Patch text through the scalar definition so unchanged lexical spelling,
						// comments and attributes survive. Restore the original QName spelling.
						const patched = definition.patch(
							clean(original),
							Schema.encodeSync(payload)(value),
						);
						return writeXmlType(
							{ ...patched, attributes: original.attributes },
							identity,
							false,
						);
					}),
			}),
		),
	);
}
// Object.keys loses the correlation between each CLR tag and its scalar
// payload type. Each branch above constructs exactly the corresponding pair.
const scalars = Schema.Union(
	Object.keys(scalarTypes).map((id) => scalarVariant(id as ScalarType)),
) as Schema.Codec<ScalarObject, XmlElement>;
export function anyObject<
	S extends Schema.ConstraintCodec<unknown, XmlElement>,
>(objects: S) {
	// Dispatch remains discriminator-based: a valid scalar payload cannot make an
	// unknown QName pass, and ordinary object variants keep their own QName checks.
	return Schema.Union([objects, scalars]);
}
