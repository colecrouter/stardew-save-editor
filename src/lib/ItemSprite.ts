import { ObjectData } from "$lib/ItemData";
import { Raw } from "$lib/proxies";
import {
	ClothingProxy,
	ColoredObjectProxy,
	HatProxy,
	type ItemProxy,
} from "$lib/proxies/items";
import { Sprite } from "$lib/Sprite.svelte";
import type { Coordinates, Size } from "$types/items";

export type SpriteTint = readonly [number, number, number, number];
export type SpriteLayer = {
	sourceRect: Coordinates & Size;
	tint?: SpriteTint;
	prismatic?: boolean;
};

export const prismaticColors: readonly SpriteTint[] = [
	[255, 0, 0, 255],
	[255, 120, 0, 255],
	[255, 217, 0, 255],
	[0, 255, 0, 255],
	[0, 255, 255, 255],
	[238, 130, 238, 255],
];

/** SpriteBatch tinting multiplies each source channel, including alpha. */
export function tintMatrix(tint: SpriteTint = [255, 255, 255, 255]) {
	const [r, g, b, a] = tint.map((channel) => channel / 255);
	return `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 ${a} 0`;
}

/** Menu drawing rules from Clothing.drawInMenu and ColoredObject.drawInMenu. */
export function getItemSprite(item?: ItemProxy) {
	if (!item?.sprite || !item.info) return undefined;
	let sprite = item.sprite;
	const smoked = item.info._key === "SmokedFish";
	if (smoked) {
		const ingredient =
			item[Raw].preservedParentSheetIndex ??
			("unpreservedItemId" in item.info
				? item.info.unpreservedItemId
				: undefined);
		const parent =
			ingredient != null
				? ObjectData.get(String(ingredient).replace(/^\([^)]*\)/, ""))
				: undefined;
		if (!parent) return undefined;
		sprite = new Sprite(parent);
	}
	if (sprite.sourceRect.width <= 0 || sprite.sourceRect.height <= 0)
		return undefined;

	const sourceRect = sprite.sourceRect;
	let layers: SpriteLayer[] = [{ sourceRect }];
	if (smoked) {
		layers.push({ sourceRect, tint: [80, 30, 10, 255 * 0.6] });
	} else if (item instanceof ClothingProxy) {
		const color = item.color;
		const defaults =
			"defaultColor" in item.info
				? item.info.defaultColor?.split(" ").map(Number)
				: undefined;
		const tint: SpriteTint = color
			? [color.R, color.G, color.B, color.A]
			: [
					defaults?.[0] ?? 255,
					defaults?.[1] ?? 255,
					defaults?.[2] ?? 255,
					defaults?.[3] ?? 255,
				];
		const prismatic =
			item.isPrismatic ?? ("isPrismatic" in item.info && item.info.isPrismatic);
		if (item.type === "Shirt") {
			layers.push({
				sourceRect: {
					...sourceRect,
					x: sourceRect.x + sprite.sheetSize.width / 2,
				},
				tint,
				prismatic,
			});
		} else {
			layers = [{ sourceRect, tint, prismatic }];
		}
	} else if (item instanceof ColoredObjectProxy) {
		const color = item.color;
		const tint: SpriteTint | undefined = color
			? [color.R, color.G, color.B, color.A]
			: undefined;
		layers = item.colorSameIndexAsParentSheetIndex
			? [{ sourceRect, tint }]
			: [{ sourceRect }, { sourceRect: sprite.getSourceRect(1), tint }];
	} else if (item instanceof HatProxy && item.isPrismatic) {
		layers = [{ sourceRect, prismatic: true }];
	}
	return { sprite, layers, smoked };
}
