import type { CatalogType } from "../compiler/catalog.ts";

// Recognition uses an inspected generic definition or an exact non-generic CLR
// type, never a parsed constructed name or an arbitrary custom enumerable.
// Additional custom serializers need their own reviewed XML contract here.
export const customSerializers = {
	"StardewValley.SerializableDictionary`2": {
		kind: "dictionary",
		comparison: undefined,
		arguments(record: CatalogType): readonly [string, string] {
			const arguments_ = record.genericArguments;
			if (arguments_?.length !== 2 || !arguments_[0] || !arguments_[1])
				throw new Error(
					`${record.id}: dictionary requires two generic arguments; reinspect the game`,
				);
			return [arguments_[0], arguments_[1]];
		},
	},
	"StardewValley.SerializableDictionaryWithCaseInsensitiveKeys`1": {
		kind: "dictionary",
		comparison: "ordinalIgnoreCase",
		arguments(record: CatalogType): readonly [string, string] {
			const arguments_ = record.genericArguments;
			if (arguments_?.length !== 1 || !arguments_[0])
				throw new Error(
					`${record.id}: case-insensitive dictionary requires one value argument; reinspect the game`,
				);
			// The reviewed subclass fixes its key type to string and inherits the
			// ordinary dictionary serializer; only its comparer changes.
			return ["System.String", arguments_[0]];
		},
	},
	"StardewValley.Inventories.Inventory": {
		kind: "inventory",
		item(record: CatalogType): string {
			if (record.elementType !== "StardewValley.Item")
				throw new Error(
					`${record.id}: inventory requires StardewValley.Item payload metadata; reinspect the game`,
				);
			return record.elementType;
		},
	},
} as const;
export function customSerializer(record: CatalogType) {
	const name = record.genericDefinition ?? record.id;
	return name && Object.hasOwn(customSerializers, name)
		? customSerializers[name as keyof typeof customSerializers]
		: undefined;
}
