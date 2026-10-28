import { Data, Result, Schema, SchemaIssue } from "effect";
import type { ItemInformation } from "$types/items";
import type { Farmer, SaveDocument } from "./domain.ts";
import type { TrinketRollContext } from "../TrinketStats.ts";
import {
	TrinketPropertyChangeSchema,
	readTrinketProperties,
} from "./trinket-properties.ts";

/** Expected invalid input, unsupported saved property, or stale item ownership. */
export class ItemPropertyInvalid extends Data.TaggedError(
	"ItemPropertyInvalid",
)<{
	readonly message: string;
}> {}
const handles = { farmerId: Schema.String, entityId: Schema.String };
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
	property: ItemPropertyChange["property"];
	label: string;
	kind: "number" | "boolean" | "color" | "select";
	value: number | boolean | string;
	min?: number;
	max?: number;
	step?: number;
	hint?: string;
	title?: string;
	options?: readonly { value: string | number; label: string }[];
}
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);
/** Valid RGB editing preserves alpha and opaque color members without filling absent data. */
export function colorHex(value: unknown): string | undefined {
	if (
		!record(value) ||
		!["R", "G", "B", "A"].every((key) => {
			const channel = value[key];
			return (
				finite(channel) &&
				Number.isInteger(channel) &&
				channel >= 0 &&
				channel <= 255
			);
		})
	)
		return undefined;
	// A malformed packed representation cannot be silently repaired by changing RGB.
	if (
		Object.hasOwn(value, "PackedValue") &&
		(!finite(value.PackedValue) ||
			!Number.isInteger(value.PackedValue) ||
			value.PackedValue < 0 ||
			value.PackedValue > 4294967295)
	)
		return undefined;
	return `#${[value.R, value.G, value.B].map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
}
/** Rebuild only RGB and an existing packed mirror; alpha and every other member survive. */
export function itemColorPatch(
	value: unknown,
	hex: string,
): Record<string, unknown> | undefined {
	if (
		!record(value) ||
		colorHex(value) === undefined ||
		!/^#[0-9a-f]{6}$/i.test(hex)
	)
		return undefined;
	const R = Number.parseInt(hex.slice(1, 3), 16),
		G = Number.parseInt(hex.slice(3, 5), 16),
		B = Number.parseInt(hex.slice(5, 7), 16);
	return {
		...value,
		R,
		G,
		B,
		...(Object.hasOwn(value, "PackedValue")
			? {
					PackedValue:
						(R | (G << 8) | (B << 16) | (Number(value.A) << 24)) >>> 0,
				}
			: {}),
	};
}
/** Resolve only usable game context; missing normal defaults do not write into the save. */
export function readItemPropertyContext(
	document: SaveDocument,
	farmer: Farmer,
): TrinketRollContext | undefined {
	const legacy = document.SaveGame.useLegacyRandom;
	const earned = farmer.totalMoneyEarned;
	if (
		(legacy !== undefined && typeof legacy !== "boolean") ||
		(earned !== undefined &&
			(!finite(earned) || !Number.isSafeInteger(earned) || earned < 0))
	)
		return undefined;
	return {
		useLegacyRandom: legacy === true,
		totalMoneyEarned: earned === undefined ? 0 : Number(earned),
	};
}

/** Describe supported fields without repairing absent, opaque, or unrecognized items. */
export function getItemPropertyFields(
	raw: unknown,
	metadata?: Pick<ItemInformation, "_type">,
	context?: TrinketRollContext,
): ItemPropertyField[] {
	if (!record(raw) || !metadata) return [];
	const type = raw["@_xsi:type"];
	const fields: ItemPropertyField[] = [];
	const number = (
		property: BaseItemPropertyChange["property"],
		label: string,
		min: number,
		max: number,
		step = 1,
	) => {
		if (finite(raw[property]))
			fields.push({
				property,
				label,
				kind: "number",
				value: raw[property],
				min,
				max,
				step,
			});
	};
	if (type === "Boots" && metadata._type === "Boots") {
		number("defenseBonus", "Defense", 0, 99);
		number("immunityBonus", "Immunity", 0, 99);
	}
	if (type === "MeleeWeapon" && metadata._type === "Weapon") {
		number("minDamage", "Minimum damage", 0, 999);
		number("maxDamage", "Maximum damage", 0, 999);
		number("knockback", "Knockback", 0, 999, 0.1);
		number("speed", "Speed", -999, 999);
		number("addedPrecision", "Precision", 0, 999);
		number("addedDefense", "Defense", 0, 999);
		number("addedAreaOfEffect", "Area of effect", 0, 999);
		number("critChance", "Critical chance", 0, 1, 0.01);
		number("critMultiplier", "Critical multiplier", 0, 999, 0.1);
	}
	if (
		(type === "Object" || type === "ColoredObject") &&
		raw.bigCraftable === false &&
		metadata._type === "Object"
	) {
		number("price", "Base price", 0, 2147483647);
		number("edibility", "Edibility", -999, 999);
	}
	if (type === "WateringCan" && metadata._type === "Tool") {
		const aliases = ["isBottomless", "IsBottomless"].filter((key) =>
			Object.hasOwn(raw, key),
		);
		// The game reads the uppercase property after the lowercase field. Show its
		// effective value without silently synchronizing a mismatched imported pair.
		if (
			aliases.length &&
			aliases.every((key) => typeof raw[key] === "boolean")
		) {
			const value =
				typeof raw.IsBottomless === "boolean"
					? raw.IsBottomless
					: raw.isBottomless;
			if (typeof value === "boolean")
				fields.push({
					property: "isBottomless",
					label: "Bottomless",
					kind: "boolean",
					value,
				});
		}
	}
	const colorProperty =
		type === "ColoredObject" && metadata._type === "Object"
			? "color"
			: type === "Clothing" &&
				  (metadata._type === "Shirt" || metadata._type === "Pants") &&
				  raw.isPrismatic !== true
				? "clothesColor"
				: undefined;
	if (colorProperty) {
		const value = colorHex(raw[colorProperty]);
		if (value)
			fields.push({
				property: colorProperty,
				label: "Color",
				kind: "color",
				value,
			});
	}
	if (type === "Trinket" && metadata._type === "Trinket" && context)
		fields.push(...readTrinketProperties(raw, context));
	return fields;
}
