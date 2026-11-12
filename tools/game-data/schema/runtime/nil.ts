import type { XmlElement } from "./xml-tree.ts";
import { assertPlainElement } from "./xml-tree.ts";
import {
	namespace,
	nilAttribute,
	typeAttribute,
	xsiNamespace,
} from "./xml-types.ts";

export function nilState(original: XmlElement) {
	const attribute = nilAttribute(original);
	const token = attribute ? original.attributes[attribute]?.trim() : undefined;
	if (token !== undefined && !["true", "1", "false", "0"].includes(token))
		throw new Error(`${original.name}: invalid xsi:nil value`);
	const nil = token === "true" || token === "1";
	const attributes = { ...original.attributes };
	if (attribute) delete attributes[attribute];
	const clean = { ...original, attributes };
	// Only non-null values may carry a type discriminator. Removing the recognized
	// nil attribute lets underlying codecs keep their existing strict boundary.
	assertPlainElement(clean, !nil);
	if (
		nil &&
		original.children.some(
			(node) =>
				node._tag === "Element" ||
				(node._tag === "Text" && node.text.trim() !== ""),
		)
	)
		throw new Error(`${original.name}: nil element contains a value`);
	return { attribute, nil, clean };
}
export function clearNil(original: XmlElement): XmlElement {
	const state = nilState(original);
	if (state.nil) return original;
	const attributes = { ...state.clean.attributes };
	const discriminator = typeAttribute(state.clean);
	if (discriminator) delete attributes[discriminator];
	// Setting nil intentionally removes the value payload and discriminator.
	// Keep element attributes/comments, and allocate a prefix without rebinding unknown XML.
	let prefix = "xsi";
	for (
		let suffix = 1;
		namespace(original, prefix) !== undefined &&
		namespace(original, prefix) !== xsiNamespace;
		suffix++
	)
		prefix = `xsi${suffix}`;
	const attribute = state.attribute ?? `${prefix}:nil`;
	if (!state.attribute) attributes[`xmlns:${prefix}`] = xsiNamespace;
	attributes[attribute] = "true";
	return {
		...original,
		attributes,
		children: original.children.filter(
			(node) =>
				node._tag === "Comment" || node._tag === "ProcessingInstruction",
		),
	};
}

export function retainFalseNil(
	original: XmlElement,
	value: XmlElement,
): XmlElement {
	const state = nilState(original);
	const attributes = { ...value.attributes };
	// A replacement may come from a scope where the old nil prefix means
	// something else. Preserve false/0 without rebinding the selected value's XML.
	if (state.attribute && !state.nil) {
		let prefix = state.attribute.split(":")[0] ?? "xsi";
		const base = prefix;
		for (
			let suffix = 1;
			namespace(value, prefix) !== undefined &&
			namespace(value, prefix) !== xsiNamespace;
			suffix++
		)
			prefix = `${base}${suffix}`;
		if (namespace(value, prefix) !== xsiNamespace)
			attributes[`xmlns:${prefix}`] = xsiNamespace;
		attributes[`${prefix}:nil`] =
			original.attributes[state.attribute] ?? "false";
	}
	return { ...value, attributes };
}
