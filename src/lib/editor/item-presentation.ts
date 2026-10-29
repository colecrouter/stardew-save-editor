import type { ImmutableView } from "./immutable-view.ts";
import {
	ItemDescription,
	ItemNameHelper,
	ObjectData,
	ResolveItemData,
} from "../ItemData.ts";
import { Sprite } from "../Sprite.svelte.ts";
import { readRgba } from "../color.ts";
import type { Item } from "../../../codegen/save.ts";
import type { ItemInformation } from "$types/items";
import type { TrinketRollContext } from "../TrinketStats.ts";
import { canEquipItem, equipmentSlots } from "./equipment.ts";
import { getItemPropertyFields } from "./item-properties.ts";

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

/** Plain drawing instructions: renderers need no saved record, catalog or Sprite instance. */
export interface ItemVisual {
	readonly sheet: string;
	readonly sheetSize: { readonly width: number; readonly height: number };
	readonly sourceRect: {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
	};
	readonly layers: readonly {
		readonly rect: ItemVisual["sourceRect"];
		readonly tint?: readonly number[];
	}[];
	readonly quality?: number;
}

/** Adapt malformed or unsupported imported metadata to an unavailable display.
 * Actual catalog implementation failures remain defects rather than unknown items. */
export function resolveItemMetadata(raw: unknown): ItemInformation | undefined {
	if (!record(raw)) return undefined;
	if (
		["itemId", "preservedParentSheetIndex"].some(
			(key) =>
				raw[key] != null &&
				typeof raw[key] !== "string" &&
				typeof raw[key] !== "number",
		) ||
		(raw.name != null && typeof raw.name !== "string")
	)
		return undefined;
	// The legacy lookup accepts generated save types; no generated type escapes
	// this adapter and no default-filling proxy is constructed to inspect a record.
	return ResolveItemData(raw as unknown as Item);
}

/** Resolve instance-specific sprite layers without retaining or normalizing saved fields. */
export function readItemVisual(
	raw: unknown,
	info = resolveItemMetadata(raw),
): ItemVisual | undefined {
	return projectItemVisual(raw, info);
}

// Presentation already resolved metadata. Keep that result, including absence,
// rather than repeating failed catalog lookup when assembling its visual.
function projectItemVisual(
	raw: unknown,
	info: ItemInformation | undefined,
): ItemVisual | undefined {
	if (!record(raw) || !info) return undefined;
	const smoked = info._key === "SmokedFish";
	const ingredient = raw.preservedParentSheetIndex;
	const parent =
		smoked && (typeof ingredient === "string" || typeof ingredient === "number")
			? ObjectData.get(String(ingredient).replace(/^\([^)]*\)/, ""))
			: undefined;
	// Smoked fish use the ingredient icon; an unknown ingredient cannot be
	// pictured reliably, so keep the renderer's explicit unknown fallback.
	if (smoked && !parent) return undefined;
	const sprite = new Sprite(parent ?? info);
	if (sprite.sourceRect.width <= 0 || sprite.sourceRect.height <= 0)
		return undefined;
	const layers: { rect: ItemVisual["sourceRect"]; tint?: readonly number[] }[] =
		[{ rect: { ...sprite.sourceRect } }];
	if (smoked) {
		layers.push({ rect: { ...sprite.sourceRect }, tint: [80, 30, 10, 153] });
	} else if (
		raw["@_xsi:type"] === "Clothing" &&
		(info._type === "Shirt" || info._type === "Pants")
	) {
		const tint = readRgba(raw.clothesColor);
		// Shirts overlay their second-sheet dye mask; pants tint their full base.
		if (info._type === "Shirt")
			layers.push({
				rect: {
					...sprite.sourceRect,
					x: sprite.sourceRect.x + sprite.sheetSize.width / 2,
				},
				tint,
			});
		else layers.splice(0, 1, { rect: { ...sprite.sourceRect }, tint });
	} else if (raw["@_xsi:type"] === "ColoredObject") {
		const tint = readRgba(raw.color);
		// Some saved colors multiply the base; others use an adjacent overlay cell.
		if (raw.colorSameIndexAsParentSheetIndex === true)
			layers.splice(0, 1, { rect: { ...sprite.sourceRect }, tint });
		else layers.push({ rect: { ...sprite.getSourceRect(1) }, tint });
	}
	return {
		sheet: sprite.sheet,
		sheetSize: { ...sprite.sheetSize },
		sourceRect: { ...sprite.sourceRect },
		layers,
		// Unknown quality tiers remain preserved elsewhere without drawing a
		// misleading vanilla badge. Normal quality intentionally has no badge.
		quality:
			raw.quality === 1 || raw.quality === 2 || raw.quality === 4
				? raw.quality
				: undefined,
	};
}

/** Present the item's meaning to UI consumers, leaving saved subtype interpretation here. */
export function readItemPresentation(
	raw: unknown,
	context?: TrinketRollContext,
	info = resolveItemMetadata(raw),
) {
	const saved = record(raw) ? raw : undefined;
	// ItemNameHelper reads string methods too. Invoke it only after the same
	// malformed-name guard used by metadata resolution, even for unknown catalog IDs.
	const readableName =
		saved && (saved.name == null || typeof saved.name === "string")
			? ItemNameHelper(saved as unknown as Item)
			: undefined;
	return {
		name: readableName ?? "Unknown item",
		description: ItemDescription(info),
		visual: projectItemVisual(raw, info),
		properties: getItemPropertyFields(raw, info, context),
		allowedEquipmentSlots: equipmentSlots.filter((key) =>
			canEquipItem(raw, key),
		),
	};
}

/** UI-facing item meaning; saved records and catalog metadata remain adapter-owned. */
export type ItemPresentation = ImmutableView<
	ReturnType<typeof readItemPresentation>
>;
