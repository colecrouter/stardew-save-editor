import { expect, it } from "vitest";
import {
	DotNetRandom,
	createGameRandom,
	createRandomSeed,
} from "../src/lib/game-random";

it("matches a mixed sequence of seeded .NET integer and floating draws", () => {
	// These are consecutive outputs of new System.Random(0), not separate
	// sequences per overload. A change in consumption would shift later values.
	const random = new DotNetRandom(0);
	expect(random.nextDouble()).toBe(0.7262432699679598);
	expect(random.next(10)).toBe(8);
	expect(random.next(-5, 5)).toBe(2);
	expect(random.nextInt()).toBe(1198642031);
});

it("retains empty-range and certain-boolean consumption behavior", () => {
	const random = new DotNetRandom(0);
	expect(random.nextBool(1)).toBe(true);
	expect(random.next(0)).toBe(0);
	expect(random.nextInt()).toBe(1755192844);
	const failedChance = new DotNetRandom(0);
	expect(failedChance.nextBool(0)).toBe(false);
	expect(failedChance.nextInt()).toBe(1755192844);
});

it("preserves Utility's different fractional seed truncation policies", () => {
	// Legacy combines doubles before its final cast; modern hashes separately
	// cast int32 inputs. Missing inputs remain zero in both representations.
	expect(createRandomSeed(true, 0.9, 0.9)).toBe(1);
	expect(createRandomSeed(true, -0.9, -0.9)).toBe(-1);
	expect(createRandomSeed(false, 0.9, 0.9)).toBe(
		createRandomSeed(false, 0, 0, 0, 0, 0),
	);
	expect(createRandomSeed(false, 777, 390176213)).toBe(238367123);
	expect(createRandomSeed(true, 777, 390176213)).toBe(390176990);
});

it("keeps independently created game sequences isolated", () => {
	const left = createGameRandom(false, 11, 390176213, 0);
	const right = createGameRandom(false, 11, 390176213, 0);
	const first = left.nextInt();
	left.nextInt();
	left.nextInt();
	expect(right.nextInt()).toBe(first);
	expect(createGameRandom(false, 11, 390176213, 0).nextInt()).toBe(first);
});
