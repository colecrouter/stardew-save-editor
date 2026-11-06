// Game-compatible deterministic randomness. This module knows no save DTO,
// Effect runtime or global entropy source: callers supply seed inputs and own
// the resulting sequence. Source: Utility.CreateRandomSeed and seeded System.Random.
const INT_MAX = 2147483647;

// --- xxHash32 (seed 0), as used by `StardewValley.Hashing.HashUtility` -------

const PRIME32_1 = 0x9e3779b1;
const PRIME32_2 = 0x85ebca77;
const PRIME32_3 = 0xc2b2ae3d;
const PRIME32_4 = 0x27d4eb2f;
const PRIME32_5 = 0x165667b1;

const rotl = (x: number, r: number) => (x << r) | (x >>> (32 - r));

/** xxHash32 of a sequence of little-endian int32 values, returned as an int32. */
function xxHash32Ints(values: readonly number[]): number {
	const length = values.length * 4;
	let i = 0;
	let h: number;

	if (length >= 16) {
		let v1 = (PRIME32_1 + PRIME32_2) | 0;
		let v2 = PRIME32_2;
		let v3 = 0;
		let v4 = -PRIME32_1 | 0;
		const round = (acc: number, lane: number) =>
			Math.imul(rotl((acc + Math.imul(lane, PRIME32_2)) | 0, 13), PRIME32_1);
		while (i + 4 <= values.length) {
			v1 = round(v1, values[i] ?? 0);
			v2 = round(v2, values[i + 1] ?? 0);
			v3 = round(v3, values[i + 2] ?? 0);
			v4 = round(v4, values[i + 3] ?? 0);
			i += 4;
		}
		h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) | 0;
	} else {
		h = PRIME32_5;
	}

	h = (h + length) | 0;
	for (; i < values.length; i++) {
		h = Math.imul(
			rotl((h + Math.imul(values[i] ?? 0, PRIME32_3)) | 0, 17),
			PRIME32_4,
		);
	}

	h = Math.imul(h ^ (h >>> 15), PRIME32_2);
	h = Math.imul(h ^ (h >>> 13), PRIME32_3);
	return (h ^ (h >>> 16)) | 0;
}

/** Combine seeds exactly as Utility.CreateRandomSeed for the save’s chosen algorithm. */
export function createRandomSeed(
	legacyRandom: boolean,
	...seeds: number[]
): number {
	// Utility accepts five doubles, defaults missing inputs to zero, and reduces
	// each input before combining. Legacy mode truncates only the final sum;
	// modern mode truncates each value before hashing five little-endian int32s.
	const parts = Array.from(
		{ length: 5 },
		(_, index) => (seeds[index] ?? 0) % INT_MAX,
	);
	return legacyRandom
		? Math.trunc(parts.reduce((sum, part) => sum + part, 0) % INT_MAX)
		: xxHash32Ints(parts.map((part) => Math.trunc(part)));
}

// --- System.Random(int seed) (.NET's legacy seeded subtractive generator) ---

/** Seeded System.Random used by Stardew. Each instance owns its sequence;
 * projections must create their own instance rather than sharing mutable state. */
export class DotNetRandom {
	private readonly seedArray = new Int32Array(56);
	private inext = 0;
	private inextp = 21;

	constructor(seed: number) {
		// Seed initialization mirrors the subtractive .NET generator, including
		// the int.MinValue special case and unchecked signed arithmetic.
		const subtraction = seed === -2147483648 ? INT_MAX : Math.abs(seed);
		let mj = 161803398 - subtraction;
		this.seedArray[55] = mj;
		let mk = 1;
		let ii = 0;
		for (let i = 1; i < 55; i++) {
			ii += 21;
			if (ii >= 55) ii -= 55;
			this.seedArray[ii] = mk;
			mk = (mj - mk) | 0; // C# int arithmetic wraps on overflow
			if (mk < 0) mk += INT_MAX;
			mj = this.at(ii);
		}
		for (let k = 1; k < 5; k++) {
			for (let i = 1; i < 56; i++) {
				let n = i + 30;
				if (n >= 55) n -= 55;
				let v = (this.at(i) - this.at(1 + n)) | 0; // wraps, see above
				if (v < 0) v += INT_MAX;
				this.seedArray[i] = v;
			}
		}
	}

	private at(i: number): number {
		return this.seedArray[i] ?? 0;
	}

	// Advance both lagged positions, retaining the new value for the next draw.
	private internalSample(): number {
		let locINext = this.inext + 1;
		if (locINext >= 56) locINext = 1;
		let locINextp = this.inextp + 1;
		if (locINextp >= 56) locINextp = 1;
		let ret = (this.at(locINext) - this.at(locINextp)) | 0;
		if (ret === INT_MAX) ret--;
		if (ret < 0) ret += INT_MAX;
		this.seedArray[locINext] = ret;
		this.inext = locINext;
		this.inextp = locINextp;
		return ret;
	}

	nextDouble(): number {
		return this.internalSample() * (1.0 / INT_MAX);
	}

	/** Random.Next(): an integer from zero through int.MaxValue - 1. */
	nextInt(): number {
		return this.internalSample();
	}

	/** Next(max) or Next(min, max), with an exclusive upper bound.
	 * Game callers here use ranges no wider than int.MaxValue. Both overloads
	 * consume one sample, including an empty range, as the game does. */
	next(max: number): number;
	next(min: number, max: number): number;
	next(minOrMax: number, upper?: number): number {
		const min = upper === undefined ? 0 : minOrMax;
		const max = upper === undefined ? minOrMax : upper;
		return Math.trunc(this.nextDouble() * (max - min)) + min;
	}

	/** `RandomExtensions.NextBool(chance)` */
	nextBool(chance: number): boolean {
		return chance >= 1 || this.nextDouble() < chance;
	}
}

/** Utility.CreateRandom: combine the supplied seeds and begin an independent sequence. */
export function createGameRandom(legacyRandom: boolean, ...seeds: number[]) {
	return new DotNetRandom(createRandomSeed(legacyRandom, ...seeds));
}
