import { Data, Effect, Result, Schema, SchemaIssue } from "effect";
import {
	clampStats,
	createRandom,
	FROG_VARIANTS,
	isEditableTrinket,
	parrotEggMaxLevel,
	QUIVER_TYPES,
	rollTrinket,
	sameStats,
	statSaveFields,
	type TrinketRollContext,
	type TrinketStats,
} from "../TrinketStats.ts";

const owner = { ownerId: Schema.String, entityId: Schema.String };
const integer = (minimum: number, maximum: number) =>
	Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum, maximum }));

/** Requested values are validated before any seed search; imported values are never repaired. */
export const TrinketPropertyChangeSchema = Schema.Union([
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:level"),
		value: integer(1, 5),
	}),
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:interval"),
		value: Schema.Finite.check(
			Schema.isBetween({ minimum: 3, maximum: 5 }),
			Schema.isMultipleOf(0.1),
		),
	}),
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:freeze"),
		value: Schema.Finite.check(
			Schema.isBetween({ minimum: 2, maximum: 4 }),
			Schema.isMultipleOf(0.1),
		),
	}),
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:duration"),
		value: integer(5, 10),
	}),
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:minDamage"),
		value: integer(8, 38),
	}),
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:delay"),
		value: Schema.Finite.check(
			Schema.isBetween({ minimum: 0.6, maximum: 2.1 }),
			Schema.isMultipleOf(0.01),
		),
	}),
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:type"),
		value: Schema.Literals(["normal", "rapid", "heavy", "perfect"]),
	}),
	Schema.Struct({
		...owner,
		property: Schema.Literal("trinket:variant"),
		value: integer(0, FROG_VARIANTS.length - 1),
	}),
]);
export type TrinketPropertyChange = typeof TrinketPropertyChangeSchema.Type;
export class TrinketPropertyInvalid extends Data.TaggedError(
	"TrinketPropertyInvalid",
)<{ readonly message: string }> {}
const invalid = (message: string) => new TrinketPropertyInvalid({ message });
const decode = Schema.decodeUnknownResult(TrinketPropertyChangeSchema, {
	onExcessProperty: "error",
});
const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

export interface TrinketPropertyField {
	property: TrinketPropertyChange["property"];
	label: string;
	kind: "number" | "select";
	value: number | string;
	min?: number;
	max?: number;
	step?: number;
	hint?: string;
	title?: string;
	options?: readonly { value: number | string; label: string }[];
}
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
// Only a saved int32 seed can reproduce the game's result. A missing or opaque
// seed remains unsupported rather than creating random data merely by viewing it.
function currentStats(
	raw: unknown,
	ctx: TrinketRollContext,
): TrinketStats | undefined {
	if (
		!record(raw) ||
		raw["@_xsi:type"] !== "Trinket" ||
		typeof raw.itemId !== "string" ||
		!Number.isInteger(raw.generationSeed) ||
		typeof raw.generationSeed !== "number" ||
		raw.generationSeed < 0 ||
		raw.generationSeed > 2147483647 ||
		typeof ctx.useLegacyRandom !== "boolean" ||
		!Number.isFinite(ctx.totalMoneyEarned) ||
		ctx.totalMoneyEarned < 0
	)
		return undefined;
	const kind = raw.itemId.replace(/^\(TR\)/, "");
	return isEditableTrinket(kind)
		? rollTrinket(
				kind,
				createRandom(raw.generationSeed, ctx.useLegacyRandom),
				ctx,
			)
		: undefined;
}
const numberField = (
	property: TrinketPropertyChange["property"],
	label: string,
	value: number,
	min: number,
	max: number,
	step: number,
	hint?: string,
): TrinketPropertyField => ({
	property,
	label,
	kind: "number",
	value,
	min,
	max,
	step,
	...(hint ? { hint } : {}),
});

/** Derive controls only from an existing seed and the current owner's game context. */
export function readTrinketProperties(
	raw: unknown,
	ctx: TrinketRollContext,
): readonly TrinketPropertyField[] {
	const stats = currentStats(raw, ctx);
	if (!stats) return [];
	switch (stats.kind) {
		case "FairyBox":
			return [
				numberField("trinket:level", "Level", stats.level, 1, 5, 1, "/ 5"),
			];
		case "ParrotEgg": {
			const cap = parrotEggMaxLevel(ctx.totalMoneyEarned);
			return [
				{
					...numberField(
						"trinket:level",
						"Level",
						stats.level,
						1,
						cap,
						1,
						`/ ${cap}`,
					),
					title: "Maximum level depends on this farmer's total money earned.",
				},
			];
		}
		case "IceRod":
			return [
				numberField(
					"trinket:interval",
					"Orb interval",
					stats.interval,
					3,
					5,
					0.1,
					"seconds · best 3.0",
				),
				numberField(
					"trinket:freeze",
					"Freeze time",
					stats.freeze,
					2,
					4,
					0.1,
					"seconds · best 4.0",
				),
			];
		case "IridiumSpur":
			return [
				numberField(
					"trinket:duration",
					"Speed boost",
					stats.duration,
					5,
					10,
					1,
					"seconds · best 10",
				),
			];
		case "MagicQuiver": {
			const range = QUIVER_TYPES[stats.type];
			return [
				{
					property: "trinket:type",
					label: "Type",
					kind: "select",
					value: stats.type,
					options: Object.entries(QUIVER_TYPES).map(([value, item]) => ({
						value,
						label: item.label,
					})),
				},
				numberField(
					"trinket:minDamage",
					"Damage",
					stats.minDamage,
					...range.minDamage,
					1,
					`–${stats.maxDamage}`,
				),
				numberField(
					"trinket:delay",
					"Fire rate",
					stats.delay,
					...range.delay,
					range.delayStep,
					"seconds between shots",
				),
			];
		}
		case "FrogEgg":
			return [
				{
					property: "trinket:variant",
					label: "Color",
					kind: "select",
					value: stats.variant,
					options: FROG_VARIANTS.map((label, value) => ({ label, value })),
				},
			];
	}
}

/**
 * Prepare only the seed and fields the game writes for that roll. The enclosing
 * capability validates ownership; this pure item policy never trusts owner handles.
 */
export const prepareTrinketPropertyChange = Effect.fn(
	"Item.prepareTrinketProperty",
)(function* (
	raw: unknown,
	input: TrinketPropertyChange,
	ctx: TrinketRollContext,
) {
	const decoded = decode(
		input && typeof input === "object" ? { ...input } : input,
	);
	if (Result.isFailure(decoded))
		return yield* invalid(
			formatIssues(decoded.failure.issue).issues[0]?.message ??
				"Choose valid trinket settings.",
		);
	const change = decoded.success;
	const current = currentStats(raw, ctx);
	if (!current || !record(raw) || typeof raw.generationSeed !== "number")
		return yield* invalid(
			"This trinket's saved seed or context is not supported.",
		);
	const field = readTrinketProperties(raw, ctx).find(
		(field) => field.property === change.property,
	);
	if (!field)
		return yield* invalid("This trinket does not support that property.");
	// Re-selecting the current type or value is not a request to re-roll its
	// other stats, refresh imported templates, or create an Undo entry.
	if (field.value === change.value) return {};
	// Static schemas cover the union's widest ranges. The derived field narrows
	// Parrot levels and quiver ranges for this owner and the current quiver type.
	if (
		typeof change.value === "number" &&
		((field.min !== undefined && change.value < field.min) ||
			(field.max !== undefined && change.value > field.max) ||
			(field.step !== undefined &&
				Math.abs(
					change.value / field.step - Math.round(change.value / field.step),
				) > 1e-7))
	)
		return yield* invalid(
			`Choose a valid ${field.label.toLowerCase()} for this trinket.`,
		);
	let target: TrinketStats = current;
	switch (change.property) {
		case "trinket:level":
			if (current.kind === "FairyBox" || current.kind === "ParrotEgg")
				target = { ...current, level: change.value };
			break;
		case "trinket:interval":
			if (current.kind === "IceRod")
				target = { ...current, interval: change.value };
			break;
		case "trinket:freeze":
			if (current.kind === "IceRod")
				target = { ...current, freeze: change.value };
			break;
		case "trinket:duration":
			if (current.kind === "IridiumSpur")
				target = { ...current, duration: change.value };
			break;
		case "trinket:minDamage":
			if (current.kind === "MagicQuiver")
				target = {
					...current,
					minDamage: change.value,
					maxDamage: change.value + 5,
				};
			break;
		case "trinket:delay":
			if (current.kind === "MagicQuiver")
				target = { ...current, delay: change.value };
			break;
		case "trinket:variant":
			if (current.kind === "FrogEgg")
				target = { ...current, variant: change.value };
			break;
		case "trinket:type":
			if (current.kind === "MagicQuiver") {
				// Changing type is a coordinated choice: keep damage as close as the new
				// range allows and choose its fastest delay, matching the existing editor.
				target = clampStats(
					{
						...current,
						type: change.value,
						delay: QUIVER_TYPES[change.value].delay[0],
					},
					ctx,
				);
			}
			break;
	}
	if (sameStats(current, target)) return {};
	// Deterministic sequential candidates avoid unnecessary random reseeding. Yield
	// between bounded batches so long searches can be interrupted when a file closes
	// and browser rendering/input gets scheduling opportunities during rare rolls.
	const seedRange = 9999999;
	const maxAttempts = 2000000;
	let selected: { seed: number; stats: TrinketStats } | undefined;
	for (let offset = 1; offset <= maxAttempts; offset++) {
		const seed = (raw.generationSeed + offset) % seedRange;
		const stats = rollTrinket(
			target.kind,
			createRandom(seed, ctx.useLegacyRandom),
			ctx,
		);
		if (sameStats(stats, target)) {
			selected = { seed, stats };
			break;
		}
		if (offset % 512 === 0) yield* Effect.yieldNow;
	}
	if (!selected)
		return yield* invalid(
			"No matching trinket roll was found. Try a different value.",
		);
	const patch: Record<string, unknown> = { generationSeed: selected.seed };
	const fields = statSaveFields(selected.stats);
	if (fields.templates)
		patch.descriptionSubstitutionTemplates = {
			string:
				fields.templates.length === 1 ? fields.templates[0] : fields.templates,
		};
	if (fields.displayName !== undefined)
		patch.displayNameOverrideTemplate =
			fields.displayName === null
				? { string: { "@_xsi:nil": "true" } }
				: { string: fields.displayName };
	return patch;
});
