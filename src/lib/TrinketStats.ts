// Trinket stats are not authoritative in the save file: whenever the game
// loads a trinket it re-rolls the stats from `generationSeed`
// (`Trinket.reloadSprite` -> `TrinketEffect.GenerateRandomStats`) and
// overwrites `descriptionSubstitutionTemplates`. To change a trinket's stats
// we therefore have to pick a seed that the game will roll into those stats,
// which means reproducing the game's RNG exactly.

/** Seeds are generated in this range by the game (and by this editor). */
const SEED_RANGE = 9999999;

export interface TrinketRollContext {
	/** `SaveGame.useLegacyRandom` */
	useLegacyRandom: boolean;
	/** `totalMoneyEarned` of the player loading the save (caps Parrot Egg level). */
	totalMoneyEarned: number;
}

// Preserve the trinket API while all game consumers share the same algorithm.
export { DotNetRandom } from "./game-random.ts";
import { type DotNetRandom, createGameRandom } from "./game-random.ts";

/** Utility.CreateRandom for a trinket's single persisted generation seed. */
export function createRandom(seed: number, useLegacyRandom: boolean) {
	return createGameRandom(useLegacyRandom, seed);
}

// --- Per-trinket stat rolls (ports of `GenerateRandomStats`) ----------------

/** `Math.Round(ms / 1000f, 1)` formatted like the game (`4.7`, `3`). */
function seconds(ms: number): number {
	const value = Math.fround(ms / 1000) * 10;
	// .NET rounds midpoints to even
	const floor = Math.floor(value);
	const diff = value - floor;
	const rounded =
		diff > 0.5 || (diff === 0.5 && floor % 2 !== 0) ? floor + 1 : floor;
	return rounded / 10;
}

export interface FairyBoxStats {
	level: number;
}

export function rollFairyBox(rng: DotNetRandom): FairyBoxStats {
	let level = 1;
	if (rng.nextBool(0.45)) level = 2;
	else if (rng.nextBool(0.25)) level = 3;
	else if (rng.nextBool(0.125)) level = 4;
	else if (rng.nextBool(0.0675)) level = 5;
	return { level };
}

export interface ParrotEggStats {
	level: number;
}

/** Highest Parrot Egg level the game will roll for this much money earned. */
export function parrotEggMaxLevel(totalMoneyEarned: number) {
	return Math.min(4, 1 + Math.floor(Math.max(0, totalMoneyEarned) / 750000));
}

export function rollParrotEgg(
	rng: DotNetRandom,
	totalMoneyEarned: number,
): ParrotEggStats {
	return { level: rng.next(0, parrotEggMaxLevel(totalMoneyEarned)) + 1 };
}

export interface IceRodStats {
	/** Seconds between orbs (3.0 - 5.0, lower is better) */
	interval: number;
	/** Seconds enemies stay frozen (2.0 - 4.0, higher is better) */
	freeze: number;
	/** "Perfect Ice Rod" (3s / 4s and a special name) */
	perfect: boolean;
}

export function rollIceRod(rng: DotNetRandom): IceRodStats {
	const interval = rng.next(3000, 5001);
	const freeze = rng.next(2000, 4001);
	if (rng.nextDouble() < 0.05) {
		return { interval: 3, freeze: 4, perfect: true };
	}
	return {
		interval: seconds(interval),
		freeze: seconds(freeze),
		perfect: false,
	};
}

export interface IridiumSpurStats {
	/** Seconds of speed boost after a critical strike (5 - 10) */
	duration: number;
}

export function rollIridiumSpur(rng: DotNetRandom): IridiumSpurStats {
	return { duration: rng.next(5, 11) };
}

export type QuiverType = "normal" | "rapid" | "heavy" | "perfect";

export interface QuiverRange {
	label: string;
	/** Lowest/highest min damage (max damage is always min + 5) */
	minDamage: [number, number];
	/** Fastest/slowest seconds between shots */
	delay: [number, number];
	delayStep: number;
}

export const QUIVER_TYPES: Record<QuiverType, QuiverRange> = {
	normal: {
		label: "Normal",
		minDamage: [13, 28],
		delay: [1.1, 2.1],
		delayStep: 0.1,
	},
	rapid: {
		label: "Rapid",
		minDamage: [8, 12],
		delay: [0.6, 0.7],
		delayStep: 0.01,
	},
	heavy: {
		label: "Heavy",
		minDamage: [23, 38],
		delay: [1.5, 2.0],
		delayStep: 0.1,
	},
	perfect: {
		label: "Perfect",
		minDamage: [30, 30],
		delay: [0.9, 0.9],
		delayStep: 0.1,
	},
};

export interface MagicQuiverStats {
	type: QuiverType;
	minDamage: number;
	maxDamage: number;
	/** Seconds between shots (lower is better) */
	delay: number;
}

export function rollMagicQuiver(rng: DotNetRandom): MagicQuiverStats {
	let type: QuiverType;
	let minDamage: number;
	let delayMs: number;
	if (rng.nextBool(0.04)) {
		type = "perfect";
		minDamage = 30;
		delayMs = 900;
	} else if (rng.nextBool(0.1)) {
		if (rng.nextBool(0.5)) {
			type = "rapid";
			minDamage = rng.next(10, 15) - 2;
			delayMs = 600 + rng.next(0, 11) * 10;
		} else {
			type = "heavy";
			minDamage = rng.next(25, 41) - 2;
			delayMs = 1500 + rng.next(0, 6) * 100;
		}
	} else {
		type = "normal";
		minDamage = rng.next(15, 31) - 2;
		delayMs = 1100 + rng.next(0, 11) * 100;
	}
	// delayMs is always a multiple of 10, so this matches `Math.Round(ms / 1000.0, 2)`
	const delay = Math.round(delayMs / 10) / 100;
	return { type, minDamage, maxDamage: minDamage + 5, delay };
}

export const FROG_VARIANTS = [
	"Green",
	"Brown",
	"Blue-Green",
	"Blue",
	"Red",
	"Yellow",
	"Void",
	"Prismatic",
] as const;

export interface FrogEggStats {
	/** Index into FROG_VARIANTS */
	variant: number;
}

export function rollFrogEgg(rng: DotNetRandom): FrogEggStats {
	let variant: number;
	if (rng.nextBool(0.2)) variant = 0;
	else if (rng.nextBool(0.8)) variant = rng.next(0, 3);
	// biome-ignore lint/suspicious/noDuplicateElseIf: each call draws a new number
	else if (rng.nextBool(0.8)) variant = rng.next(0, 3) + 3;
	else variant = rng.next(0, 2) + 6;
	return { variant };
}

// --- Generic access by trinket id --------------------------------------------

export type TrinketStats =
	| ({ kind: "FairyBox" } & FairyBoxStats)
	| ({ kind: "ParrotEgg" } & ParrotEggStats)
	| ({ kind: "IceRod" } & IceRodStats)
	| ({ kind: "IridiumSpur" } & IridiumSpurStats)
	| ({ kind: "MagicQuiver" } & MagicQuiverStats)
	| ({ kind: "FrogEgg" } & FrogEggStats);

export type TrinketKind = TrinketStats["kind"];

const KINDS = new Set<string>([
	"FairyBox",
	"ParrotEgg",
	"IceRod",
	"IridiumSpur",
	"MagicQuiver",
	"FrogEgg",
]);

export const isEditableTrinket = (key: string): key is TrinketKind =>
	KINDS.has(key);

/** Roll the stats the game will generate for a trinket from this RNG. */
export function rollTrinket(
	kind: TrinketKind,
	rng: DotNetRandom,
	ctx: TrinketRollContext,
): TrinketStats {
	switch (kind) {
		case "FairyBox":
			return { kind, ...rollFairyBox(rng) };
		case "ParrotEgg":
			return { kind, ...rollParrotEgg(rng, ctx.totalMoneyEarned) };
		case "IceRod":
			return { kind, ...rollIceRod(rng) };
		case "IridiumSpur":
			return { kind, ...rollIridiumSpur(rng) };
		case "MagicQuiver":
			return { kind, ...rollMagicQuiver(rng) };
		case "FrogEgg":
			return { kind, ...rollFrogEgg(rng) };
	}
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

const snap = (value: number, min: number, max: number, step: number) =>
	Math.round(
		(min + Math.round((clamp(value, min, max) - min) / step) * step) * 100,
	) / 100;

/** Clamp/snap requested stats to values the game can actually roll. */
export function clampStats(
	stats: TrinketStats,
	ctx: TrinketRollContext,
): TrinketStats {
	switch (stats.kind) {
		case "FairyBox":
			return { ...stats, level: Math.round(clamp(stats.level, 1, 5)) };
		case "ParrotEgg":
			return {
				...stats,
				level: Math.round(
					clamp(stats.level, 1, parrotEggMaxLevel(ctx.totalMoneyEarned)),
				),
			};
		case "IceRod":
			return {
				...stats,
				interval: snap(stats.interval, 3, 5, 0.1),
				freeze: snap(stats.freeze, 2, 4, 0.1),
			};
		case "IridiumSpur":
			return { ...stats, duration: Math.round(clamp(stats.duration, 5, 10)) };
		case "MagicQuiver": {
			const range = QUIVER_TYPES[stats.type] ?? QUIVER_TYPES.normal;
			const minDamage = Math.round(clamp(stats.minDamage, ...range.minDamage));
			return {
				...stats,
				minDamage,
				maxDamage: minDamage + 5,
				delay: snap(stats.delay, ...range.delay, range.delayStep),
			};
		}
		case "FrogEgg":
			return {
				...stats,
				variant: Math.round(clamp(stats.variant, 0, FROG_VARIANTS.length - 1)),
			};
	}
}

/** Whether two rolls match on every stat the editor lets you choose. */
export function sameStats(a: TrinketStats, b: TrinketStats): boolean {
	switch (a.kind) {
		case "FairyBox":
		case "ParrotEgg":
			return a.kind === b.kind && a.level === b.level;
		case "IceRod":
			return (
				b.kind === "IceRod" &&
				a.interval === b.interval &&
				a.freeze === b.freeze
			);
		case "IridiumSpur":
			return b.kind === "IridiumSpur" && a.duration === b.duration;
		case "MagicQuiver":
			return (
				b.kind === "MagicQuiver" &&
				a.type === b.type &&
				a.minDamage === b.minDamage &&
				a.delay === b.delay
			);
		case "FrogEgg":
			return b.kind === "FrogEgg" && a.variant === b.variant;
	}
}

const localized = (key: string) =>
	`[LocalizedText Strings\\1_6_Strings:${key}]`;

export interface TrinketSaveFields {
	/** New `descriptionSubstitutionTemplates` values, or `undefined` to leave them */
	templates?: (string | number)[];
	/** New display name template, `null` to clear it, or `undefined` to leave it */
	displayName?: string | null;
}

/**
 * What the game's `GenerateRandomStats` writes for these stats. Display names
 * the game sets but never clears (e.g. "Perfect Ice Rod") are cleared here.
 */
export function statSaveFields(stats: TrinketStats): TrinketSaveFields {
	switch (stats.kind) {
		case "FairyBox":
			return { templates: [stats.level] };
		case "ParrotEgg":
			return {
				templates: [
					stats.level,
					localized(`ParrotEgg_Chance_${stats.level - 1}`),
				],
			};
		case "IceRod":
			return {
				templates: [stats.interval, stats.freeze],
				displayName: stats.perfect ? localized("PerfectIceRod") : null,
			};
		case "IridiumSpur":
			return { templates: [stats.duration] };
		case "MagicQuiver": {
			const names: Record<QuiverType, string | null> = {
				normal: null,
				rapid: localized("RapidMagicQuiver"),
				heavy: localized("HeavyMagicQuiver"),
				perfect: localized("PerfectMagicQuiver"),
			};
			return {
				templates: [stats.delay, stats.minDamage, stats.maxDamage],
				displayName: names[stats.type],
			};
		}
		case "FrogEgg":
			return { displayName: localized(`frog_variant_${stats.variant}`) };
	}
}

/**
 * Find a generation seed whose rolled stats satisfy `matches`.
 * Starts at a random seed so repeated searches don't always return the same one.
 */
export function findSeed<T>(
	roll: (rng: DotNetRandom) => T,
	matches: (stats: T) => boolean,
	useLegacyRandom: boolean,
	maxAttempts = 2_000_000,
): number | undefined {
	const start = Math.floor(Math.random() * SEED_RANGE);
	for (let i = 0; i < Math.min(maxAttempts, SEED_RANGE); i++) {
		const seed = (start + i) % SEED_RANGE;
		if (matches(roll(createRandom(seed, useLegacyRandom)))) return seed;
	}
	return undefined;
}

/** Find a seed that rolls `target` (after clamping it to rollable values). */
export function findSeedForStats(
	target: TrinketStats,
	ctx: TrinketRollContext,
): number | undefined {
	const wanted = clampStats(target, ctx);
	return findSeed(
		(rng) => rollTrinket(wanted.kind, rng, ctx),
		(rolled) => sameStats(rolled, wanted),
		ctx.useLegacyRandom,
	);
}
