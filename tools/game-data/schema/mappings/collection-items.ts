import type { CatalogTypes } from "../compiler/catalog.ts";
import type { ValueContract } from "../compiler/contract.ts";

export function collectionItemValue(
	types: CatalogTypes,
	itemType: string,
	value: ValueContract,
	allowNil = true,
): ValueContract {
	// XmlSerializer's wrapped collections and standalone arrays/lists retain null
	// reference slots. Repeated XmlElement siblings use a different default and
	// must not call this rule. XmlArrayItem(IsNullable=false) suppresses these slots.
	if (!allowNil || value.kind === "nullable") return value;
	const reference =
		itemType === "System.String" ||
		(value.kind === "object" &&
			types.get(itemType)?.baseType !== "System.ValueType") ||
		value.kind === "array" ||
		value.kind === "inventory" ||
		value.kind === "dictionary";
	// A string-enumerating wrapper may expose a narrower enum-text codec. Its
	// physical item type is still a string, so nil uses the same outer envelope.
	// Value-type scalars, enums and structs keep their non-null item contracts.
	return reference ? { kind: "nullable", value } : value;
}
