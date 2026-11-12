import type { CatalogType } from "../compiler/catalog.ts";

// Arrays and List<T> share XmlSerializer's ArrayOf... value representation. Keep
// this recognition separate from ordinary member enumeration: NetField and custom
// collections can have different standalone contracts despite being enumerable.
export function sequenceItem(record: CatalogType): string | undefined {
	if (record.kind !== "collection" || record.customXml) return undefined;
	const list = record.genericDefinition === "System.Collections.Generic.List`1";
	if (!list && !record.id.endsWith("[]")) return undefined;
	if (!record.elementType)
		throw new Error(
			`${record.id}: sequence item metadata is missing; reinspect the game`,
		);
	if (
		list &&
		(record.genericArguments?.length !== 1 ||
			record.genericArguments[0] !== record.elementType)
	)
		throw new Error(
			`${record.id}: List requires one matching generic/item type; reinspect the game`,
		);
	// Built-in arrays/lists have no XML type overrides. Do not silently apply this
	// representation to a future annotated collection with a different contract.
	if (record.attributes?.length)
		throw new Error(`${record.id}: sequence type attributes are unsupported`);
	return record.elementType;
}
