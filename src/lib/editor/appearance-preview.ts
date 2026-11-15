import type { Farmer } from "./domain.ts";
import { ItemData, ResolveItemData } from "../ItemData.ts";
import { Sprite } from "../Sprite.svelte.ts";
import { readRgba } from "../color.ts";
import {
	PrimarySkinColors,
	SecondarySkinColors,
	TertiarySkinColors,
	PrimaryBootColors,
	SecondaryBootColors,
	TertiaryBootColors,
	QuaternaryBootColors,
} from "../CharacterColors.ts";

export interface AppearanceLayer {
	readonly part: string;
	readonly sheet: string;
	readonly x: number;
	readonly y: number;
	readonly tint?: readonly number[];
}
/** Ready-to-render composition; consumers need no saved farmer or equipment fields. */
export interface AppearancePreviewView {
	readonly layers: readonly AppearanceLayer[];
	readonly gender: "male" | "female";
	readonly notice?: string;
}
// Concrete equipment fields already have generated contracts. Resolve their
// catalog identity directly without revalidating decoded object shapes.
type Equipment = Farmer["boots" | "shirtItem" | "pantsItem" | "hat"];
const equipment = (raw: Equipment) =>
	raw == null ? undefined : ResolveItemData(raw);
/** Build ordered sprite layers without holding save references or changing defaults. */
export function appearanceLayers(
	farmer: Farmer | undefined,
): AppearancePreviewView {
	const layers: AppearanceLayer[] = [];
	if (
		!farmer ||
		(farmer.gender !== "Male" && farmer.gender !== "Female") ||
		farmer.skin === undefined
	)
		return {
			layers,
			gender: "male",
			notice: "This saved appearance cannot be previewed.",
		};
	const gender = farmer.gender === "Male" ? "male" : "female";
	const skin = [
		PrimarySkinColors[farmer.skin],
		SecondarySkinColors[farmer.skin],
		TertiarySkinColors[farmer.skin],
	];
	if (skin.some((color) => !color))
		return { layers, gender, notice: "This custom skin cannot be previewed." };
	const add = (
		part: string,
		sheet: string,
		x: number,
		y: number,
		tint?: readonly number[],
	) => layers.push({ part, sheet, x, y, tint });
	const skinLayer = (part: string, sheet: string) => {
		for (const [index, x] of [16, 32, 48].entries()) {
			const color = skin[2 - index];
			if (color) add(part, sheet, x, 0, [color.R, color.G, color.B, color.A]);
		}
	};
	skinLayer("base", `/img/${gender}_farmer.png`);
	add("eyes", `/img/${gender}_farmer_other.png`, 0, 0);
	add(
		"iris",
		`/img/${gender}_farmer_other.png`,
		32,
		0,
		readRgba(farmer.newEyeColor),
	);
	const boots = equipment(farmer.boots);
	const bootPalettes = [
		PrimaryBootColors,
		SecondaryBootColors,
		TertiaryBootColors,
		QuaternaryBootColors,
	];
	// Feet live in the split footwear sheet, not the body sheet. Always compose
	// their geometry even when the equipment slot is empty. Saved shoe colors
	// remain useful without boots; unsupported/custom palettes get the game's
	// default shoes (2) as a display-only fallback, never a saved replacement.
	const savedShoes =
		farmer.shoes !== undefined && /^\d+$/.test(farmer.shoes)
			? Number(farmer.shoes)
			: 2;
	const requestedBootIndex = boots
		? farmer.boots?.indexInColorSheet !== undefined
			? farmer.boots.indexInColorSheet
			: 0
		: savedShoes;
	const bootIndex =
		Number.isInteger(requestedBootIndex) &&
		bootPalettes.every((palette) => palette[requestedBootIndex] !== undefined)
			? requestedBootIndex
			: 2;
	for (const [index, palette] of bootPalettes.entries()) {
		const color = palette[bootIndex];
		if (color)
			add(
				"boots",
				`/img/${gender}_farmer_boots.png`,
				[48, 32, 0, 16][index] ?? 0,
				0,
				[color.R, color.G, color.B, color.A],
			);
	}
	// Missing equipment receives the same display-only stand-ins as v1. These
	// catalog records are never inserted into the save or constructed as proxies.
	const shirt =
		equipment(farmer.shirtItem) ??
		ItemData.get(
			gender === "male" ? "Basic Pullover (M)" : "Basic Pullover (F)",
		);
	const pants = equipment(farmer.pantsItem) ?? ItemData.get("Polka Dot Shorts");
	let notice: string | undefined;
	if (
		[farmer.hat, farmer.shirtItem, farmer.pantsItem, farmer.boots].some(
			(value) => value != null && !equipment(value),
		)
	)
		notice =
			"Some imported equipment cannot be previewed; clothing stand-ins may be shown.";
	for (const [part, info, saved] of [
		["pants", pants, farmer.pantsItem],
		["shirt", shirt, farmer.shirtItem],
	] as const) {
		if (!info || (info._type !== "Pants" && info._type !== "Shirt")) {
			notice = "Some equipped clothing cannot be previewed.";
			continue;
		}
		const sprite = new Sprite(info),
			pos = sprite.dimensions;
		const tint =
			info.canBeDyed && saved != null
				? readRgba(saved.clothesColor)
				: undefined;
		add(
			part,
			`/assets/${sprite.sheet}`,
			// Pants dimensions point at the inventory icon, 672px below the
			// standing animation. Draw the full frame at body origin; female
			// frames sit 96px to the right within the same pants block.
			pos.x -
				(part === "pants" && gender === "female" ? 96 : 0) -
				(part === "shirt" && info.canBeDyed ? sprite.sheetSize.width / 2 : 0),
			pos.y + (part === "pants" ? 672 : 0),
			tint,
		);
	}
	const hairTint = readRgba(farmer.hairstyleColor);
	if (
		farmer.accessory !== undefined &&
		farmer.accessory >= 0 &&
		farmer.accessory <= 29
	) {
		const pos = Sprite.fromIndex(farmer.accessory, 16, 32, 128, 128);
		add("accessory", "/assets/accessories.png", pos.x, pos.y, hairTint);
	}
	const hat = equipment(farmer.hat);
	// Match the legacy preview's hat/hair rule to keep appearance composition
	// consistent between editors.
	if (!hat || hat._type !== "Hat" || !hat.showRealHair) {
		const saved = farmer.hair;
		if (saved !== undefined) {
			const hair = saved >= 100 ? saved - 44 : saved;
			if (hair >= 0 && hair <= 73) {
				const second = hair >= 56;
				const pos = Sprite.fromIndex(
					second ? hair - 56 : hair,
					16,
					second ? 128 : 96,
					128,
					672,
				);
				add(
					"hair",
					`/assets/hairstyles${second ? "2" : ""}.png`,
					pos.x,
					pos.y,
					hairTint,
				);
			} else notice = "This custom hairstyle cannot be previewed.";
		}
	}
	if (hat?._type === "Hat") {
		const sprite = new Sprite(hat);
		add(
			"hat",
			`/assets/${sprite.sheet}`,
			sprite.dimensions.x,
			sprite.dimensions.y,
		);
	}
	skinLayer("arms", `/img/${gender}_farmer_arms.png`);
	return { layers, gender, notice };
}
