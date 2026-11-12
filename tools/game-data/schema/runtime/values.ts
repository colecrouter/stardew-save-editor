import {
	Effect,
	Option,
	Schema,
	SchemaIssue,
	SchemaTransformation,
} from "effect";
import type { XmlElement } from "./xml-tree.ts";
import {
	XmlElementSchema,
	readElementText,
	replaceElementText,
} from "./xml-tree.ts";
import { nilState, clearNil, retainFalseNil } from "./nil.ts";

// A value definition owns XML conversion and edit behavior; a field binding owns
// names, placement, cardinality and presence. Text is an optional capability used
// by attribute bindings, not a representation every definition must expose.
export interface XmlValue<A> {
	readonly _xmlValue: true;
	readonly itemName?: string;
	readonly element: Schema.Codec<A, XmlElement>;
	readonly patch: (original: XmlElement, encoded: XmlElement) => XmlElement;
}
export type TextValue<A> = XmlValue<A> &
	Schema.Codec<A, string> & { readonly text: Schema.Codec<A, string> };
export function isXmlValue(value: object): value is XmlValue<unknown> {
	return "_xmlValue" in value && value._xmlValue === true;
}
const attempt = <A>(run: () => A) =>
	Effect.try({
		try: run,
		catch: (error) => new SchemaIssue.InvalidValue({ message: String(error) }),
	});
function emptyElement(): XmlElement {
	// This placeholder is never a user-selected field name: bindings rename the
	// encoded node when placing it into its original parent.
	return { _tag: "Element", name: "Value", attributes: {}, children: [] };
}
export function textValue<A>(
	text: Schema.Codec<A, string>,
	itemName?: string,
): TextValue<A> {
	const element = XmlElementSchema.pipe(
		Schema.decodeTo(
			text,
			SchemaTransformation.transformEffect({
				decode: (original) => attempt(() => readElementText(original)),
				encode: (encoded) =>
					attempt(() => replaceElementText(emptyElement(), encoded)),
			}),
		),
	);
	// Keep the schema surface for existing callers that use text codecs directly.
	// New bindings use the explicit capabilities rather than inspecting schema ASTs.
	// Clone the schema wrapper before adding capabilities: shared Schema.String
	// and registry codecs must not acquire another definition's naming metadata.
	return Object.assign(text.annotate({}), {
		_xmlValue: true as const,
		itemName,
		text,
		element,
		patch: (original: XmlElement, encoded: XmlElement) => {
			// A list edit may touch this slot while its own value is unchanged. Compare
			// through the same text codec to retain numeric spelling and comments.
			// A nullable wrapper may be filling a previously empty element. There
			// is then no old scalar value to compare, so write the validated new text.
			const before = Schema.decodeOption(text)(readElementText(original));
			const after = Schema.decodeSync(text)(readElementText(encoded));
			return Option.isSome(before) &&
				Schema.toEquivalence(Schema.toType(text))(before.value, after)
				? original
				: replaceElementText(original, readElementText(encoded));
		},
	});
}
export function value<A>(
	element: Schema.Codec<A, XmlElement>,
	itemName?: string,
): XmlValue<A> {
	// Object codecs carry their own preserved trees. Replacing one selects that
	// tree instead of adopting a previous object's unknown fields.
	return {
		_xmlValue: true,
		itemName,
		element,
		patch: (_original, encoded) => encoded,
	};
}
export function nullable<A>(
	input: XmlValue<A> | Schema.Codec<A, XmlElement>,
): XmlValue<A | null> {
	const inner = isXmlValue(input)
		? (input as XmlValue<A>)
		: value(input as Schema.Codec<A, XmlElement>);
	const element = XmlElementSchema.pipe(
		Schema.decodeTo(
			Schema.NullOr(inner.element),
			SchemaTransformation.transformEffect({
				decode: (original) =>
					attempt(() => {
						const state = nilState(original);
						return state.nil ? null : state.clean;
					}),
				encode: (encoded) =>
					attempt(() =>
						encoded === null ? clearNil(emptyElement()) : encoded,
					),
			}),
		),
	);
	return {
		_xmlValue: true,
		itemName: inner.itemName,
		element,
		patch: (original, encoded) => {
			if (nilState(encoded).nil) return clearNil(original);
			const patched = inner.patch(nilState(original).clean, encoded);
			return retainFalseNil(original, patched);
		},
	};
}
export function enumeration<const Labels extends readonly string[]>(
	labels: Labels,
) {
	return textValue(Schema.Literals(labels));
}
