import { isKnownItem, type InventoryValue } from "./inventory-values.ts";
import { colorHex } from "../color.ts";
export { colorHex, itemColorPatch } from "../color.ts";
import { Data, Result, Schema, SchemaIssue } from "effect";
import type { ItemInformation } from "$types/items";
import type { Farmer, SaveDocument } from "./domain.ts";
import type { TrinketRollContext } from "../TrinketStats.ts";
import {
	TrinketPropertyChangeSchema,
	readTrinketProperties,
} from "./trinket-properties.ts";
import type { TrinketPatch } from "./trinket-properties.ts";
import type { T_Microsoft_Xna_Framework_Color } from "../../../generated/save-format/save.ts";

/** Expected invalid input, unsupported saved property, or stale item ownership. */
export class ItemPropertyInvalid extends Data.TaggedError(
	"ItemPropertyInvalid",
)<{
	readonly message: string;
}> {}
const handles = { ownerId: Schema.String, entityId: Schema.String };
const integer = (min: number, max: number) =>
	Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: min, maximum: max }),
	);
const decimal = (min: number, max: number) =>
	Schema.Finite.check(Schema.isBetween({ minimum: min, maximum: max }));
// Every branch owns its game-format range. These validate requests, not imported
// baselines: an unusual existing stat stays untouched until explicitly replaced.
const BaseItemPropertyChangeSchema = Schema.Union([
	Schema.Struct({
		...handles,
		property: Schema.Literals(["defenseBonus", "immunityBonus"]),
		value: integer(0, 99),
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literals([
			"minDamage",
			"maxDamage",
			"addedPrecision",
			"addedDefense",
			"addedAreaOfEffect",
		]),
		value: integer(0, 999),
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literals(["knockback", "critMultiplier"]),
		value: decimal(0, 999),
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literal("speed"),
		value: integer(-999, 999),
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literal("critChance"),
		value: decimal(0, 1),
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literal("price"),
		value: integer(0, 2147483647),
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literal("edibility"),
		value: integer(-999, 999),
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literal("isBottomless"),
		value: Schema.Boolean,
	}),
	Schema.Struct({
		...handles,
		property: Schema.Literals(["color", "clothesColor"]),
		value: Schema.String.check(Schema.isPattern(/^#[0-9a-f]{6}$/i)),
	}),
]);
/** The one request contract used by inspector controls and the write boundary. */
export const ItemPropertyChangeSchema = Schema.Union([
	BaseItemPropertyChangeSchema,
	TrinketPropertyChangeSchema,
]);
export type ItemPropertyChange = typeof ItemPropertyChangeSchema.Type;
export type BaseItemPropertyChange = typeof BaseItemPropertyChangeSchema.Type;
// Approved patches contain only command-owned fields. Their scalar/color types
// stay explicit through staging and replay instead of reverting to a generic record.
type NumericProperty = Extract<
	BaseItemPropertyChange,
	{ value: number }
>["property"];
export type ItemPatch = Partial<
	Record<NumericProperty | "stack" | "quality", number> & {
		isBottomless: boolean;
		IsBottomless: boolean;
		color: T_Microsoft_Xna_Framework_Color;
		clothesColor: T_Microsoft_Xna_Framework_Color;
	}
> &
	TrinketPatch;
const decode = Schema.decodeUnknownResult(ItemPropertyChangeSchema, {
	onExcessProperty: "error",
});
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
/** Decode own fields only; prototype values never authorize an item property write. */
export function decodeItemPropertyChange(
	input: unknown,
): Result.Result<ItemPropertyChange, ItemPropertyInvalid> {
	const result = decode(
		input && typeof input === "object" && !Array.isArray(input)
			? { ...input }
			: input,
	);
	return Result.isFailure(result)
		? Result.fail(
				new ItemPropertyInvalid({
					message:
						formatter(result.failure.issue).issues[0]?.message ??
						"Enter a valid item property.",
				}),
			)
		: Result.succeed(result.success);
}

/** Display policy is shared with command enforcement; values are detached saved data. */
export interface ItemPropertyField {
	readonly property: ItemPropertyChange["property"];
	readonly label: string;
	readonly kind: "number" | "boolean" | "color" | "select";
	readonly value: number | boolean | string;
	readonly min?: number;
	readonly max?: number;
	readonly step?: number;
	readonly hint?: string;
	readonly title?: string;
	readonly options?: readonly {
		readonly value: string | number;
		readonly label: string;
	}[];
}
const finite = (value: number | undefined): value is number =>
	value !== undefined && Number.isFinite(value);
/** Resolve only usable game context; missing normal defaults do not write into the save. */
export function readItemPropertyContext(
	document: SaveDocument,
	farmer: Farmer,
): TrinketRollContext {
	const legacy = document.SaveGame.useLegacyRandom;
	const earned = farmer.totalMoneyEarned;
	// Both values have generated scalar types. Omission uses the game's defaults;
	// no inspection-time write is needed to materialize them in the save.
	return { useLegacyRandom: legacy ?? false, totalMoneyEarned: earned ?? 0 };
}

/** Describe supported fields without repairing absent, opaque, or unrecognized items. */
export function getItemPropertyFields(
	raw: InventoryValue,
	metadata?: Pick<ItemInformation, "_type">,
	context?: TrinketRollContext,
): ItemPropertyField[] {
	if (!isKnownItem(raw) || !metadata) return [];
	const type = raw.$type;
	const fields: ItemPropertyField[] = [];
	const number = (
		property: BaseItemPropertyChange["property"],
		label: string,
		value: number | undefined,
		min: number,
		max: number,
		step = 1,
	) => {
		if (finite(value))
			fields.push({
				property,
				label,
				kind: "number",
				value,
				min,
				max,
				step,
			});
	};
	if (type === "StardewValley.Objects.Boots" && metadata._type === "Boots") {
		number("defenseBonus", "Defense", raw.defenseBonus, 0, 99);
		number("immunityBonus", "Immunity", raw.immunityBonus, 0, 99);
	}
	if (
		type === "StardewValley.Tools.MeleeWeapon" &&
		metadata._type === "Weapon"
	) {
		number("minDamage", "Minimum damage", raw.minDamage, 0, 999);
		number("maxDamage", "Maximum damage", raw.maxDamage, 0, 999);
		number("knockback", "Knockback", raw.knockback, 0, 999, 0.1);
		number("speed", "Speed", raw.speed, -999, 999);
		number("addedPrecision", "Precision", raw.addedPrecision, 0, 999);
		number("addedDefense", "Defense", raw.addedDefense, 0, 999);
		number(
			"addedAreaOfEffect",
			"Area of effect",
			raw.addedAreaOfEffect,
			0,
			999,
		);
		number("critChance", "Critical chance", raw.critChance, 0, 1, 0.01);
		number(
			"critMultiplier",
			"Critical multiplier",
			raw.critMultiplier,
			0,
			999,
			0.1,
		);
	}
	if (
		(type === "StardewValley.Object" ||
			type === "StardewValley.Objects.ColoredObject") &&
		raw.bigCraftable === false &&
		metadata._type === "Object"
	) {
		number("price", "Base price", raw.price, 0, 2147483647);
		number("edibility", "Edibility", raw.edibility, -999, 999);
	}
	if (type === "StardewValley.Tools.WateringCan" && metadata._type === "Tool") {
		const aliases = (["isBottomless", "IsBottomless"] as const).filter((key) =>
			Object.hasOwn(raw, key),
		);
		// The game reads the uppercase property after the lowercase field. Show its
		// effective value without silently synchronizing a mismatched imported pair.
		if (aliases.length && aliases.every((key) => raw[key] !== undefined)) {
			const value =
				raw.IsBottomless !== undefined ? raw.IsBottomless : raw.isBottomless;
			if (value !== undefined)
				fields.push({
					property: "isBottomless",
					label: "Bottomless",
					kind: "boolean",
					value,
				});
		}
	}
	// Color payloads belong to these concrete generated variants. Never read a
	// similarly named extension field on another item class as editable color.
	if (
		type === "StardewValley.Objects.ColoredObject" &&
		metadata._type === "Object"
	) {
		const value = colorHex(raw.color);
		if (value)
			fields.push({ property: "color", label: "Color", kind: "color", value });
	} else if (
		type === "StardewValley.Objects.Clothing" &&
		(metadata._type === "Shirt" || metadata._type === "Pants") &&
		raw.isPrismatic !== true
	) {
		const value = colorHex(raw.clothesColor);
		if (value)
			fields.push({
				property: "clothesColor",
				label: "Color",
				kind: "color",
				value,
			});
	}
	if (
		type === "StardewValley.Objects.Trinket" &&
		metadata._type === "Trinket" &&
		context
	)
		fields.push(...readTrinketProperties(raw, context));
	return fields;
}
