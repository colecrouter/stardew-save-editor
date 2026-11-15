import { ItemData, ItemDescription } from "../ItemData.ts";
import { Sprite } from "../Sprite.svelte.ts";

/** Display-only output metadata, independent of raw save records and legacy proxies. */
// Optional presentation members may be omitted or explicitly unavailable.
// These transient projections do not encode presence of serialized save fields.
export interface RecipePresentation {
	description?: string | undefined;
	sprite?:
		| {
				sheet: string;
				sheetWidth: number;
				sheetHeight: number;
				x: number;
				y: number;
				width: number;
				height: number;
		  }
		| undefined;
}
const cache = new Map<string, RecipePresentation>();
/** Resolve static catalog metadata once; unsupported outputs retain a visible fallback. */
export function recipePresentation(
	outputName: string | undefined,
): RecipePresentation {
	if (!(outputName != null && outputName !== "")) return {};
	const existing = cache.get(outputName);
	if (existing) return existing;
	const info = ItemData.get(outputName);
	if (!info) return {};
	const sprite = new Sprite(info);
	const result: RecipePresentation = { description: ItemDescription(info) };
	// A catalog entry can exist without a supported sheet rectangle. Never draw
	// another cell as a substitute for a missing recipe picture.
	if (sprite.sourceRect.width > 0 && sprite.sourceRect.height > 0) {
		result.sprite = {
			sheet: `/assets/${sprite.sheet}`,
			sheetWidth: sprite.sheetSize.width,
			sheetHeight: sprite.sheetSize.height,
			...sprite.sourceRect,
		};
	}
	cache.set(outputName, result);
	return result;
}
