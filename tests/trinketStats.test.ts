import { describe, expect, it } from "vitest";
import {
	createRandom,
	findSeed,
	findSeedForStats,
	type MagicQuiverStats,
	QUIVER_TYPES,
	type QuiverType,
	rollFairyBox,
	rollFrogEgg,
	rollIceRod,
	rollIridiumSpur,
	rollMagicQuiver,
	rollParrotEgg,
	rollTrinket,
	type TrinketStats,
} from "$lib/TrinketStats";

/*
	Seeds and the stats the game rolled for them, taken from a real 1.6 save
	(`useLegacyRandom` false). If these fail, the RNG port doesn't match the game.
*/

const fairyBoxes: [number, number][] = [
	[751922, 5],
	[1031938, 3],
	[1335573, 4],
	[2217064, 3],
	[3045145, 3],
	[3219258, 3],
	[3822846, 3],
	[4822223, 5],
	[5380973, 3],
	[6038282, 3],
	[7906929, 4],
	[8242372, 3],
	[9192970, 2],
	[9517698, 3],
];

// Rolled with totalMoneyEarned >= 2,250,000 (max level 4)
const parrotEggs: [number, number][] = [
	[325479, 1],
	[650028, 2],
	[1176629, 3],
	[1374253, 2],
	[1993999, 4],
	[3130762, 3],
	[3988152, 1],
	[4145825, 2],
	[5603167, 1],
	[6248437, 1],
	[8172562, 1],
	[8321130, 4],
	[8473951, 4],
	[8980989, 4],
];

const iceRods: [
	number,
	{ interval: number; freeze: number; perfect: boolean },
][] = [
	[816755, { interval: 3.4, freeze: 3, perfect: false }],
	[2851205, { interval: 4.7, freeze: 2.2, perfect: false }],
	[2928630, { interval: 3.9, freeze: 3.2, perfect: false }],
	[4127231, { interval: 3.1, freeze: 2.1, perfect: false }],
	[4306464, { interval: 4.8, freeze: 4, perfect: false }],
	[5905630, { interval: 4, freeze: 2.2, perfect: false }],
	[6514079, { interval: 3, freeze: 4, perfect: true }],
	[7876966, { interval: 3.5, freeze: 3.9, perfect: false }],
	[8266693, { interval: 4, freeze: 2.7, perfect: false }],
	[8273830, { interval: 3, freeze: 4, perfect: true }],
	[8751388, { interval: 4.4, freeze: 2.5, perfect: false }],
	[9453582, { interval: 3, freeze: 4, perfect: true }],
];

const iridiumSpurs: [number, number][] = [
	[1333383, 6],
	[1988518, 7],
	[3865134, 9],
	[4368268, 8],
	[4563891, 7],
	[4602309, 8],
	[4668645, 5],
	[4735627, 7],
	[7499772, 7],
	[8311519, 10],
	[9500885, 9],
	[9755688, 8],
];

const magicQuivers: [number, MagicQuiverStats][] = [
	[1447691, { type: "normal", minDamage: 17, maxDamage: 22, delay: 1.5 }],
	[3373721, { type: "normal", minDamage: 21, maxDamage: 26, delay: 1.9 }],
	[4235273, { type: "normal", minDamage: 21, maxDamage: 26, delay: 1.1 }],
	[4749993, { type: "normal", minDamage: 26, maxDamage: 31, delay: 1.9 }],
	[4998022, { type: "normal", minDamage: 27, maxDamage: 32, delay: 2.1 }],
	[5421853, { type: "perfect", minDamage: 30, maxDamage: 35, delay: 0.9 }],
	[7198526, { type: "normal", minDamage: 22, maxDamage: 27, delay: 1.4 }],
	[733774, { type: "normal", minDamage: 19, maxDamage: 24, delay: 1.2 }],
	[7573726, { type: "normal", minDamage: 27, maxDamage: 32, delay: 2 }],
	[8402112, { type: "normal", minDamage: 26, maxDamage: 31, delay: 1.6 }],
];

// One Frog Egg in the source save is left out: its saved name doesn't match its seed
const frogEggs: [number, number][] = [
	[1575895, 6],
	[1700869, 4],
	[1899211, 1],
	[1904174, 2],
	[2880645, 0],
	[2906334, 2],
	[3623114, 0],
	[4763764, 2],
	[5668980, 0],
	[5772619, 2],
	[5882010, 0],
	[6259979, 1],
	[7135581, 0],
	[7230434, 1],
	[7443697, 3],
	[8843719, 1],
	[9901043, 0],
];

describe("TrinketStats", () => {
	it.each(
		iridiumSpurs,
	)("rolls Golden Spur seed %i as %is", (seed, duration) => {
		expect(rollIridiumSpur(createRandom(seed, false)).duration).toBe(duration);
	});

	it.each(magicQuivers)("rolls Magic Quiver seed %i as %o", (seed, stats) => {
		expect(rollMagicQuiver(createRandom(seed, false))).toEqual(stats);
	});

	it.each(frogEggs)("rolls Frog Egg seed %i as variant %i", (seed, variant) => {
		expect(rollFrogEgg(createRandom(seed, false)).variant).toBe(variant);
	});

	it("finds a seed for every Magic Quiver type's best and worst stats", () => {
		const ctx = { useLegacyRandom: false, totalMoneyEarned: 0 };
		for (const [type, range] of Object.entries(QUIVER_TYPES)) {
			for (const minDamage of range.minDamage) {
				for (const delay of range.delay) {
					const target: TrinketStats = {
						kind: "MagicQuiver",
						type: type as QuiverType,
						minDamage,
						maxDamage: minDamage + 5,
						delay,
					};
					const seed = findSeedForStats(target, ctx);
					expect(seed, JSON.stringify(target)).toBeDefined();
					expect(
						rollTrinket("MagicQuiver", createRandom(seed ?? 0, false), ctx),
					).toEqual(target);
				}
			}
		}
	});

	it.each(fairyBoxes)("rolls Fairy Box seed %i as level %i", (seed, level) => {
		expect(rollFairyBox(createRandom(seed, false)).level).toBe(level);
	});

	it.each(parrotEggs)("rolls Parrot Egg seed %i as level %i", (seed, level) => {
		expect(rollParrotEgg(createRandom(seed, false), 14862987).level).toBe(
			level,
		);
	});

	it.each(iceRods)("rolls Ice Rod seed %i as %o", (seed, stats) => {
		expect(rollIceRod(createRandom(seed, false))).toEqual(stats);
	});

	it("caps Parrot Egg level by money earned", () => {
		for (let seed = 0; seed < 200; seed++) {
			expect(rollParrotEgg(createRandom(seed, false), 0).level).toBe(1);
			expect(
				rollParrotEgg(createRandom(seed, false), 750000).level,
			).toBeLessThanOrEqual(2);
		}
	});

	it("finds seeds for every Fairy Box level", () => {
		for (const legacy of [false, true]) {
			for (let level = 1; level <= 5; level++) {
				const seed = findSeed(rollFairyBox, (s) => s.level === level, legacy);
				expect(seed).toBeDefined();
				expect(rollFairyBox(createRandom(seed as number, legacy)).level).toBe(
					level,
				);
			}
		}
	});
});
