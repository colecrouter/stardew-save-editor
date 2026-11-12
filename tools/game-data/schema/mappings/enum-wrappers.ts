import type { CatalogType } from "../compiler/catalog.ts";

// These wrappers implement text serialization in addition to inherited NetField
// interfaces. Adding another wrapper requires reviewing its enumerator/Add pair.
export const enumWrappers = {
	"Netcode.NetNullableEnum`1": {
		enumType(record: CatalogType): string {
			const args = record.genericArguments;
			if (
				args?.length !== 1 ||
				!args[0] ||
				record.elementType !== "System.String"
			)
				throw new Error(
					`${record.id}: nullable enum wrapper requires string serialization and one enum argument; reinspect the game`,
				);
			return args[0];
		},
	},
} as const;
export function enumWrapper(record: CatalogType) {
	const name = record.genericDefinition;
	return name && Object.hasOwn(enumWrappers, name)
		? enumWrappers[name as keyof typeof enumWrappers]
		: undefined;
}
