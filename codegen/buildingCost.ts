export interface BuildMaterial {
	/** The item's name, as generated/iteminfo.json is keyed */
	item: string;
	amount: number;
}

/**
    Map a building's `BuildMaterials` from Data/Buildings.json to item names.
    Materials are objects with qualified IDs like `(O)388`; any that aren't
    known objects are left out.
*/
export function getBuildMaterials(
	materials:
		| { ItemId?: string | null; Amount?: number | null }[]
		| null
		| undefined,
	objectNames: ReadonlyMap<string, string>,
): BuildMaterial[] {
	return (materials ?? []).flatMap(({ ItemId, Amount }) => {
		const id = ItemId?.replace(/^\(O\)/, "");
		const item = id && objectNames.get(id);
		return item ? [{ item, amount: Amount ?? 1 }] : [];
	});
}
