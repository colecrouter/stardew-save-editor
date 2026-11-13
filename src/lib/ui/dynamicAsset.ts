import { asset } from "$app/paths";

/** Resolve catalog-derived asset references without treating their names as a closed union. */
export function dynamicAsset(path: string): string {
	// Domain views retain root-relative paths, while Kit 3 accepts asset-relative
	// inputs. These references are app-owned asset paths assembled from game data;
	// their runtime names cannot be narrowed to Kit's generated static-file union.
	const relativePath = path.replace(/^\//, "");
	// Keep Kit's deployment-base and URL behavior, including caller-provided escaping.
	// Unknown/modded names intentionally keep their existing local 404/image fallback.
	return asset(relativePath as Parameters<typeof asset>[0]);
}
