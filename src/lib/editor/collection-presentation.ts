import { readItemVisual, resolveItemMetadata } from "./item-presentation.ts";

/** Collection keys identify objects, not arbitrary inventory variants. Resolve
 * display hints without creating items or interpreting imported extension data. */
export function collectionPresentation(id: string) {
	const object = { $type: "StardewValley.Object" as const, itemId: id };
	const info = resolveItemMetadata(object);
	return {
		// Generated displayName can still contain a LocalizedText token. The
		// catalog's resolved lookup name matches the rest of this English editor.
		name: info?.name,
		visual: readItemVisual(object, info),
	};
}
