import { assets } from "$app/manifest";
import { asset } from "$app/paths";
import type { AssetPath } from "$app/types";

// Kit's manifest supplies the validated values, while catalog/save references
// remain strings. Index raw and segment-encoded spellings without widening the
// values passed to asset(): every stored value is a shipped AssetPath.
const shippedPaths = new Map<string, AssetPath>();
for (const { path } of assets) {
	shippedPaths.set(path, path);
	shippedPaths.set(path.split("/").map(encodeURIComponent).join("/"), path);
}

/** Resolve a runtime catalog reference only when its image is actually shipped. */
export function dynamicAsset(path: string): string | undefined {
	// Older domain projections retain a leading slash. Missing/modded references
	// remain absent so each renderer can select its own existing fallback.
	const relativePath = path.replace(/^\//, "");
	const shippedPath = shippedPaths.get(relativePath);
	return shippedPath === undefined ? undefined : asset(shippedPath);
}
