import { isXmlValue } from "./values.ts";
import type { XmlValue } from "./values.ts";
import { keyComparisonSchema } from "../mappings/key-identities.ts";
import type { DictionaryKeyComparison } from "../mappings/key-identities.ts";
import { Schema, SchemaTransformation } from "effect";
import { structure } from "../xml-codecs.ts";
import {
	boxed,
	boxedObject,
	boxedValue,
	objectElements,
} from "../mappings/structures.ts";
import type { XmlElement } from "./xml-tree.ts";
import { XmlElementSchema } from "./xml-tree.ts";

export function dictionary<K, V>(
	keyName: string,
	key: Schema.Codec<K, string | XmlElement>,
	valueName: string,
	value: Schema.Codec<V, string | XmlElement>,
	objectValue: boolean,
	identity?: DictionaryKeyComparison,
) {
	// Entries retain their own original trees, so moving an entry carries its
	// unknown XML and both key/value wrappers instead of adopting another slot.
	const valueField =
		isXmlValue(value) && !("text" in value)
			? boxedValue("value", valueName, value as XmlValue<V>)
			: objectValue
				? boxedObject("value", valueName, value as Schema.Codec<V, XmlElement>)
				: boxed(
						"value",
						valueName,
						value as Schema.Codec<V, string>,
						valueName === "string" ? ["int"] : [],
					);
	// Only registered object keys use element payloads. Scalar/enum keys retain
	// their existing text codecs and legacy string aliases.
	const keyField =
		identity && identity !== "ordinalIgnoreCase"
			? boxedObject("key", keyName, key as Schema.Codec<K, XmlElement>)
			: boxed(
					"key",
					keyName,
					key as Schema.Codec<K, string>,
					keyName === "string" ? ["int", "LocationContext"] : [],
				);
	const entry: Schema.Codec<
		{
			readonly value: { readonly key: K; readonly value: V };
			readonly original: XmlElement;
		},
		XmlElement
	> = structure({
		key: keyField,
		value: valueField,
	});
	const envelope = structure({ entries: objectElements("item", entry) });
	// Expose the dictionary as an ordered array of preserved entries. A JS record
	// would coerce non-string keys and discard entry order and XML provenance.
	const target = Schema.Struct({
		value: Schema.Array(Schema.toType(entry)),
		original: XmlElementSchema,
	});
	const comparison = identity
		? keyComparisonSchema(key, identity)
		: Schema.toType(key);
	const equalKey = Schema.toEquivalence(comparison);
	return envelope.pipe(
		Schema.decodeTo(
			target,
			SchemaTransformation.transform({
				decode: ({ value, original }) => ({ value: value.entries, original }),
				encode: ({ value, original }) => ({
					value: { entries: value },
					original,
				}),
			}),
		),
		Schema.check(
			Schema.makeFilter<typeof target.Type>(({ value }) => {
				// Match Dictionary.Add using decoded key identity. Numeric spellings
				// and preserved XML cannot conceal duplicate scalar or structured keys.
				const keys: K[] = [];
				for (const entry of value) {
					if (keys.some((previous) => equalKey(entry.value.key, previous)))
						return "Duplicate dictionary key";
					keys.push(entry.value.key);
				}
				return undefined;
			}),
		),
	);
}
