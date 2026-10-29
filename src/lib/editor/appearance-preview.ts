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
import type { Item } from "../../../codegen/save.ts";

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
export interface AppearanceLayer {
	part: string;
	sheet: string;
	x: number;
	y: number;
	tint?: readonly number[];
}
/** Resolve imported equipment through the existing read-only catalog adapter.
 * The one generated-type cast stays here: no reactive Item/Farmer proxies are created. */
function equipment(raw: unknown) {
	if (!record(raw) || raw["@_xsi:nil"] === true || raw["@_xsi:nil"] === "true")
		return undefined;
	// Legacy catalog lookups use string methods on these optional identifiers.
	// Reject malformed imported shapes before invoking them; unexpected catalog
	// defects remain visible rather than being converted into missing equipment.
	if (
		["name", "itemId", "preservedParentSheetIndex"].some(
			(key) =>
				raw[key] != null &&
				typeof raw[key] !== "string" &&
				typeof raw[key] !== "number",
		)
	)
		return undefined;
	if (raw.name != null && typeof raw.name !== "string") return undefined;
	return ResolveItemData(raw as unknown as Item);
}
/** Build ordered sprite layers without holding save references or changing defaults. */
export function appearanceLayers(raw: Record<string, unknown> | undefined) {
	const layers: AppearanceLayer[] = [];
	if (
		!raw ||
		(raw.gender !== "Male" && raw.gender !== "Female") ||
		typeof raw.skin !== "number" ||
		!Number.isInteger(raw.skin)
	)
		return {
			layers,
			gender: "male",
			notice: "This saved appearance cannot be previewed.",
		};
	const gender = raw.gender === "Male" ? "male" : "female";
	const skin = [
		PrimarySkinColors[raw.skin],
		SecondarySkinColors[raw.skin],
		TertiarySkinColors[raw.skin],
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
		readRgba(raw.newEyeColor),
	);
	const boots = equipment(raw.boots);
	const bootIndex =
		record(raw.boots) && typeof raw.boots.indexInColorSheet === "number"
			? raw.boots.indexInColorSheet
			: 0;
	if (boots) {
		for (const [index, palette] of [
			PrimaryBootColors,
			SecondaryBootColors,
			TertiaryBootColors,
			QuaternaryBootColors,
		].entries()) {
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
	}
	// Missing equipment receives the same display-only stand-ins as v1. These
	// catalog records are never inserted into the save or constructed as proxies.
	const shirt =
		equipment(raw.shirtItem) ??
		ItemData.get(
			gender === "male" ? "Basic Pullover (M)" : "Basic Pullover (F)",
		);
	const pants = equipment(raw.pantsItem) ?? ItemData.get("Polka Dot Shorts");
	let notice: string | undefined;
	const present = (value: unknown) =>
		value !== undefined &&
		!(
			record(value) &&
			(value["@_xsi:nil"] === true || value["@_xsi:nil"] === "true")
		);
	if (
		[raw.hat, raw.shirtItem, raw.pantsItem, raw.boots].some(
			(value) => present(value) && !equipment(value),
		)
	)
		notice =
			"Some imported equipment cannot be previewed; clothing stand-ins may be shown.";
	for (const [part, info, saved] of [
		["pants", pants, raw.pantsItem],
		["shirt", shirt, raw.shirtItem],
	] as const) {
		if (!info || (info._type !== "Pants" && info._type !== "Shirt")) {
			notice = "Some equipped clothing cannot be previewed.";
			continue;
		}
		const sprite = new Sprite(info),
			pos = sprite.dimensions;
		const tint =
			info.canBeDyed && record(saved)
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
	const hairTint = readRgba(raw.hairstyleColor);
	if (
		typeof raw.accessory === "number" &&
		Number.isInteger(raw.accessory) &&
		raw.accessory >= 0 &&
		raw.accessory <= 29
	) {
		const pos = Sprite.fromIndex(raw.accessory, 16, 32, 128, 128);
		add("accessory", "/assets/accessories.png", pos.x, pos.y, hairTint);
	}
	const hat = equipment(raw.hat);
	// Reuse legacy preview's hat/hair rule so this migration doesn't change
	// appearance composition while replacing its reactive data dependencies.
	if (!hat || hat._type !== "Hat" || !hat.showRealHair) {
		const saved = raw.hair;
		if (typeof saved === "number" && Number.isInteger(saved)) {
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
