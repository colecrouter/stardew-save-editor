// The asset generator writes [lookup name, metadata] entries. Declaring that
// contract prevents the large heterogeneous JSON array from degrading to any;
// generator fixtures own the data contract, while consumers narrow item families.
declare module "$generated/iteminfo.json" {
	import type { ItemInformation } from "$types/items";

	const entries: [string, ItemInformation][];
	export default entries;
}

// Texture sizes use the same entry encoding and are generated with the catalog.
declare module "$generated/dimensions.json" {
	import type { Size } from "$types/items";

	const entries: [string, Size][];
	export default entries;
}
