import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { objectElements } from "../mappings/structures.ts";
import { structure } from "../xml-codecs.ts";
import { nullable } from "./values.ts";
import type { XmlElement } from "./xml-tree.ts";
import { XmlElementSchema } from "./xml-tree.ts";

const attempt = <A>(run: () => A) =>
	Effect.try({
		try: run,
		catch: (error) => new SchemaIssue.InvalidValue({ message: String(error) }),
	});
export function inventorySlot<A>(item: Schema.Codec<A, XmlElement>) {
	// A slot keeps its own provenance even when empty. Occupied values are the
	// usual polymorphic item envelopes; null therefore never erases a slot index.
	const definition = nullable(item);
	const target = Schema.Struct({
		value: definition.element,
		original: XmlElementSchema,
	});
	return XmlElementSchema.pipe(
		Schema.decodeTo(
			target,
			SchemaTransformation.transformEffect({
				decode: (original) => attempt(() => ({ value: original, original })),
				// Inventory retains slot provenance; nullable owns the XML nil transitions.
				// The same wrapper now serves scalar fields and polymorphic item slots.
				encode: ({ value, original }) =>
					attempt(() => definition.patch(original, value)),
			}),
		),
	);
}

export function inventory<A>(item: Schema.Codec<A, XmlElement>) {
	const slot = inventorySlot(item);
	const envelope = structure({ slots: objectElements("Item", slot) });
	// Expose a preserved ordered array, matching the dictionary/list envelope
	// convention. Empty Inventory means zero slots, not a fixed number of nulls.
	return envelope.pipe(
		Schema.decodeTo(
			Schema.Struct({
				value: Schema.Array(Schema.toType(slot)),
				original: XmlElementSchema,
			}),
			SchemaTransformation.transform({
				decode: ({ value, original }) => ({ value: value.slots, original }),
				encode: ({ value, original }) => ({
					value: { slots: value },
					original,
				}),
			}),
		),
	);
}
