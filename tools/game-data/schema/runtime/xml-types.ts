import type { XmlElement } from "./xml-tree.ts";

export const xsiNamespace = "http://www.w3.org/2001/XMLSchema-instance";
export interface XmlTypeName {
	readonly name: string;
	readonly namespace: string;
}

export function namespace(
	element: XmlElement,
	prefix: string,
): string | undefined {
	// Prefixes are literal XML names, including names found on Object.prototype.
	// Local declarations override inherited scope; xml has its predefined binding.
	const declaration = prefix ? `xmlns:${prefix}` : "xmlns";
	if (Object.hasOwn(element.attributes, declaration))
		return element.attributes[declaration];
	if (element.namespaces && Object.hasOwn(element.namespaces, prefix))
		return element.namespaces[prefix];
	if (prefix === "xml") return "http://www.w3.org/XML/1998/namespace";
	return prefix ? undefined : "";
}
// XML Schema instance attributes use expanded names, so inherited aliases and
// duplicate aliases have the same meaning as the conventional xsi prefix.
function instanceAttribute(
	element: XmlElement,
	local: string,
): string | undefined {
	const names = Object.keys(element.attributes).filter((name) => {
		const parts = name.split(":");
		return (
			parts.length === 2 &&
			parts[1] === local &&
			namespace(element, parts[0] ?? "") === xsiNamespace
		);
	});
	if (names.length > 1)
		throw new Error(`${element.name}: duplicate xsi:${local} attributes`);
	return names[0];
}
export function typeAttribute(element: XmlElement): string | undefined {
	return instanceAttribute(element, "type");
}
export function nilAttribute(element: XmlElement): string | undefined {
	return instanceAttribute(element, "nil");
}

export function readXmlType(element: XmlElement): XmlTypeName | undefined {
	const attribute = typeAttribute(element);
	if (!attribute) return undefined;
	const value = element.attributes[attribute]?.trim() ?? "";
	const parts = value.split(":");
	if (
		parts.length > 2 ||
		parts.some((part) => !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(part))
	)
		throw new Error(`${element.name}: invalid xsi:type ${value}`);
	const uri = namespace(element, parts.length === 2 ? (parts[0] ?? "") : "");
	if (uri === undefined || (parts.length === 2 && !uri))
		throw new Error(`${element.name}: unbound xsi:type prefix in ${value}`);
	return { name: parts.at(-1) ?? "", namespace: uri };
}
export function sameXmlType(left: XmlTypeName, right: XmlTypeName): boolean {
	return left.name === right.name && left.namespace === right.namespace;
}
export function writeXmlType(
	element: XmlElement,
	expected: XmlTypeName,
	allowMissing: boolean,
): XmlElement {
	const previous = readXmlType(element);
	// Preserve the user's QName/prefix spelling when its expanded name is right.
	if (
		(previous && sameXmlType(previous, expected)) ||
		(!previous && allowMissing)
	)
		return element;
	const attributes = { ...element.attributes };
	const old = typeAttribute(element);
	if (old) delete attributes[old];
	// Choose unused local prefixes instead of overwriting namespace bindings used
	// by unknown XML. New declarations make this node independently movable.
	const free = (base: string, uri: string): string => {
		let name = base;
		for (
			let suffix = 1;
			namespace(element, name) !== undefined &&
			namespace(element, name) !== uri;
			suffix++
		)
			name = `${base}${suffix}`;
		attributes[`xmlns:${name}`] = uri;
		return name;
	};
	const xsi = free("xsi", xsiNamespace);
	const value = expected.namespace
		? `${free("t", expected.namespace)}:${expected.name}`
		: expected.name;
	if (!expected.namespace && namespace(element, ""))
		throw new Error(
			"Cannot encode an unqualified xsi:type under a default XML namespace",
		);
	attributes[`${xsi}:type`] = value;
	return { ...element, attributes };
}
