export interface BuildMaterial {
	/** Item name, as used by generated/iteminfo.json */
	item: string;
	amount: number;
}

/**
    Map a building's `BuildMaterials` from Data/Buildings.json to item names.
    Materials use qualified IDs like `(O)388`; ones that aren't objects are dropped.
*/
export function getBuildMaterials(
	materials: { ItemId?: string; Amount?: number }[] | null | undefined,
	objectNames: ReadonlyMap<string, string>,
): BuildMaterial[] {
	return (materials ?? []).flatMap(({ ItemId, Amount }) => {
		const id = ItemId?.replace(/^\(O\)/, "");
		const item = id && objectNames.get(id);
		return item ? [{ item, amount: Amount ?? 1 }] : [];
	});
}
