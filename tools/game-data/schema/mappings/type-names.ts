import type { CatalogTypes } from "../compiler/catalog.ts";
import { readTypeAnnotations } from "./type-annotations.ts";
import { isScalarType, scalarTypes } from "./scalars.ts";
import { sequenceItem } from "./sequences.ts";

function clrName(
	types: CatalogTypes,
	id: string,
	active = new Set<string>(),
): string {
	// Constructed CLR IDs contain namespaces and brackets inside their arguments.
	// Read the inspected definition/arguments instead of splitting that whole ID.
	if (active.has(id))
		throw new Error(`${id}: recursive generic naming metadata`);
	const type = types.get(id);
	if (id.endsWith("[]") && type?.kind === "collection" && type.elementType) {
		active.add(id);
		// Generic type defaults use CLR names, so int[] contributes ArrayOfInt32,
		// unlike its standalone XML root ArrayOfInt.
		const name = `ArrayOf${clrName(types, type.elementType, active)}`;
		active.delete(id);
		return name;
	}
	const definition = type?.genericDefinition;
	if (!definition) {
		if (id.includes("[") || id.includes("`"))
			throw new Error(
				`${id}: generic naming metadata is missing; reinspect the game`,
			);
		// Nested CLR classes use '+' in their full ID, but their own XML default
		// name is the inner class name, not the containing class's name.
		return id.split(/[.+]/).at(-1) ?? id;
	}
	const name = definition.split(/[.+]/).at(-1) ?? definition;
	const arity = name.match(/`(\d+)$/);
	const args = type.genericArguments;
	if (!arity || !args?.length || args.length !== Number(arity[1]))
		throw new Error(
			`${id}: generic naming metadata is incomplete; reinspect the game`,
		);
	active.add(id);
	// XmlSerializer constructs generic defaults from CLR argument names. An
	// argument's XmlRoot/XmlType override does not rename its parent generic type.
	const suffix = args
		.map((argument) => clrName(types, argument, active))
		.join("");
	active.delete(id);
	return `${name.replace(/`\d+$/, "")}Of${suffix}`;
}
export function serializationNames(types: CatalogTypes, id: string) {
	const type = types.get(id);
	if (!type) throw new Error(`${id}: missing type metadata for XML naming`);
	// Root names and collection/type names are distinct annotation contexts.
	// XmlRoot("dictionary") does not change SerializableDictionaryOfInt64Inventory.
	// System.Object is XML Schema's universal type, not a user-defined class named
	// Object. Its QName must stay distinct from StardewValley.Object.
	if (id === "System.Object")
		return {
			...readTypeAnnotations(type, "anyType"),
			typeNamespace: "http://www.w3.org/2001/XMLSchema",
		};
	return readTypeAnnotations(type, clrName(types, id));
}
function nullablePayload(types: CatalogTypes, id: string): string | undefined {
	const record = types.get(id);
	if (record?.kind !== "nullable") return undefined;
	const args = record.genericArguments;
	if (
		record.genericDefinition !== "System.Nullable`1" ||
		args?.length !== 1 ||
		!args[0]
	)
		throw new Error(
			`${id}: nullable naming metadata is incomplete; reinspect the game`,
		);
	if (args[0] === id || types.get(args[0])?.kind === "nullable")
		throw new Error(`${id}: nested nullable CLR metadata is invalid`);
	return args[0];
}
export function rootElementName(
	types: CatalogTypes,
	id: string,
	active: ReadonlySet<string> = new Set(),
): string {
	const record = types.get(id);
	const item = record ? sequenceItem(record) : undefined;
	if (item) {
		if (active.has(id))
			throw new Error(`${id}: recursive array/list naming metadata`);
		const name = collectionItemName(types, item, new Set([...active, id]));
		return `ArrayOf${name[0]?.toUpperCase()}${name.slice(1)}`;
	}
	const inner = nullablePayload(types, id);
	if (inner) return rootElementName(types, inner);
	return isScalarType(id)
		? scalarTypes[id].xmlItemName
		: serializationNames(types, id).rootName;
}
export function collectionItemName(
	types: CatalogTypes,
	id: string,
	active: ReadonlySet<string> = new Set(),
): string {
	const record = types.get(id);
	const item = record ? sequenceItem(record) : undefined;
	if (item) {
		if (active.has(id))
			throw new Error(`${id}: recursive array/list naming metadata`);
		const name = collectionItemName(types, item, new Set([...active, id]));
		return `ArrayOf${name[0]?.toUpperCase()}${name.slice(1)}`;
	}
	const inner = nullablePayload(types, id);
	// Nullable<T> changes the value domain and nil handling, not its payload name.
	if (inner) return collectionItemName(types, inner);
	// Scalar items use XML built-in names (long), while a generic argument's CLR
	// default name remains Int64. Keep that distinction out of the contract walker.
	return isScalarType(id)
		? scalarTypes[id].xmlItemName
		: serializationNames(types, id).typeName;
}
