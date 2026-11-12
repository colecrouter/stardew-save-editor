import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import type { XmlValue } from "./values.ts";
import type { XmlElement } from "./xml-tree.ts";
import { XmlElementSchema, assertPlainElement } from "./xml-tree.ts";
import { patchSiblings } from "../mappings/structures.ts";

export function array<A>(
	item: XmlValue<A>,
	itemName = item.itemName,
): XmlValue<readonly A[]> & Schema.Codec<readonly A[], XmlElement> {
	if (!itemName)
		throw new Error("Array item name is required for this value definition");
	// Arrays and ordinary List<T> values share this XmlSerializer representation.
	// A containing field may rename the root; nested sequences use this default
	// root as their item name. CLR container identity is resolved by the compiler.
	const name = itemName;
	const rootName = `ArrayOf${name[0]?.toUpperCase()}${name.slice(1)}`;
	const select = (original: XmlElement): readonly XmlElement[] => {
		assertPlainElement(original);
		return original.children.filter(
			(node): node is XmlElement =>
				node._tag === "Element" && node.name === name,
		);
	};
	const attempt = <B>(run: () => B) =>
		Effect.try({
			try: run,
			catch: (error) =>
				new SchemaIssue.InvalidValue({ message: String(error) }),
		});
	const element = XmlElementSchema.pipe(
		Schema.decodeTo(
			Schema.Array(item.element),
			SchemaTransformation.transformEffect({
				decode: (original) => attempt(() => select(original)),
				encode: (values) =>
					attempt(() => {
						// Stage encoded items under their shared inherited namespace scope. Without
						// this, the temporary wrapper would force redundant declarations onto every
						// object item and make a no-op look like an XML edit. Conflicting scopes
						// remain local to their items through the normal list placement helper.
						const scopes = values.flatMap((value) =>
							value.namespaces ? [value.namespaces] : [],
						);
						const namespaces = Object.fromEntries(
							Object.entries(scopes[0] ?? {}).filter(
								([prefix, uri]) =>
									prefix &&
									prefix !== "xml" &&
									scopes.every(
										(scope) =>
											Object.hasOwn(scope, prefix) && scope[prefix] === uri,
									),
							),
						);
						const attributes = Object.fromEntries(
							Object.entries(namespaces).map(([prefix, uri]) => [
								`xmlns:${prefix}`,
								uri,
							]),
						);
						const wrapper: XmlElement = {
							_tag: "Element",
							name: rootName,
							attributes,
							namespaces,
							children: [],
						};
						return patchSiblings(wrapper, name, values, false, item.patch);
					}),
			}),
		),
	);
	// Decode to an ordinary array. Its owning field/entry keeps provenance, and this
	// patcher reuses existing item slots so scalar edits retain attributes/comments.
	// Object items still carry their own original trees when moved or inserted.
	return Object.assign(element, {
		_xmlValue: true as const,
		itemName: rootName,
		element,
		patch: (original: XmlElement, encoded: XmlElement) => {
			assertPlainElement(original);
			return patchSiblings(original, name, select(encoded), false, item.patch);
		},
	});
}
