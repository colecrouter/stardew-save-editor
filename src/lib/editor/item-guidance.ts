import { ItemData } from "../ItemData.ts";
import { immutableView } from "./immutable-view.ts";
import { type ItemVisual, readItemVisual } from "./item-presentation.ts";

/** Static item guidance never creates a writable item or retains a save instance. */
// Optional presentation members may be omitted or explicitly unavailable.
// These transient projections do not encode presence of serialized save fields.
export interface GuidanceItem {
	readonly name: string;
	readonly visual?: ItemVisual | undefined;
}
const cache = new Map<string, GuidanceItem>();
/** Resolve only displayed gift/material drawings; unknown names keep their readable fallback. */
export function guidanceItem(name: string): GuidanceItem {
	const found = cache.get(name);
	if (found) return found;
	const metadata = ItemData.get(name);
	// Empty instance data deliberately selects the catalog's ordinary menu icon.
	// These are recommendations/materials, not saved instances with tint or quality.
	const result = immutableView({
		name,
		visual: metadata ? readItemVisual({}, metadata) : undefined,
	});
	cache.set(name, result);
	return result;
}
