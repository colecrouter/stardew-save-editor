import type { ClothesType, Item as ItemModel, TypeEnum } from "$types/save";

/**
 * The shared subset of the generated XML `Item` shape that every proxy touches.
 *
 * This codifies the fields listed in [`plans/item-model-interfaces-plan.md`](plans/item-model-interfaces-plan.md)
 * while mirroring the structure derived from [`codegen/save.ts:1274`](codegen/save.ts:1274).
 */
export interface ItemModelBase extends ItemModel {
	/** present for XML entries emitted by `codegen/save.ts` */
	_type?: string;
	/** preserved for legacy `TypeEnum` data (e.g., rings) */
	type?: TypeEnum | number;
	/** some subclasses rely on XML xsi:type (colored objects, hats, rings, etc.) */
	"@_xsi:type"?: string;
}

export interface WeaponItemModel extends ItemModelBase {
	_type: "Weapon";
	minDamage?: number;
	maxDamage?: number;
	speed?: number;
	knockback?: number;
	critChance?: number;
	critMultiplier?: number;
	addedPrecision?: number;
	addedAreaOfEffect?: number;
	addedDefense?: number;
	immunityBonus?: number;
}

export interface BootsItemModel extends ItemModelBase {
	_type: "Boots";
	addedDefense?: number;
	immunityBonus?: number;
	indexInColorSheet?: number;
}

export interface HatItemModel extends ItemModelBase {
	_type: "Hat";
	which?: null;
	skipHairDraw?: boolean;
	ignoreHairstyleOffset?: boolean;
	hairDrawType?: number;
}

export interface ClothingItemModel extends ItemModelBase {
	_type: "Shirt" | "Pants";
	clothesType?: ClothesType;
	clothesColor?: ItemModel["clothesColor"];
	dyeable?: boolean;
	canBeDyed?: boolean;
}

export interface RingItemModel extends ItemModelBase {
	_type: "Object";
	type: TypeEnum.Ring;
	"@_xsi:type": "Ring";
	uniqueID?: number;
}

export interface ColoredObjectItemModel extends ItemModelBase {
	_type: "Object";
	"@_xsi:type": "ColoredObject";
	color?: ItemModel["color"];
}

export interface TrinketItemModel extends ItemModelBase {
	_type: "Trinket";
	generationSeed?: number;
	displayNameOverrideTemplate?: string;
	descriptionSubstitutionTemplates?: string[];
	trinketMetadata?: Record<string, string>;
	displayNameFormat?: string;
	name: ItemModel["name"];
}

export interface ToolItemModel extends ItemModelBase {
	_type: "Tool";
	upgradeLevel?: number;
	numAttachmentSlots?: number;
	attachments?: ItemModel["attachments"];
	"@_xsi:type"?: string;
}

export function hasRawType<Type extends string>(
	raw: ItemModelBase,
	expected: Type,
): raw is ItemModelBase & { _type: Type } {
	return raw._type === expected;
}

export function hasXsiType<Type extends string>(
	raw: ItemModelBase,
	expected: Type,
): raw is ItemModelBase & { "@_xsi:type": Type } {
	return raw["@_xsi:type"] === expected;
}

export function hasTypeEnum(expected: TypeEnum) {
	return (raw: ItemModelBase): raw is ItemModelBase & { type: TypeEnum } => {
		return raw.type === expected;
	};
}
