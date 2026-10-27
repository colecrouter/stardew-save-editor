import { Result } from "effect";
import { describe, expect, it } from "vitest";
import { decodeFarmSettingsChange } from "../../src/lib/editor/farm-settings";

// These request-only tests avoid loading a save: imported values are preserved
// separately, while every deliberate partial command shares these same rules.
describe("farm settings request schema", () => {
	it.each([1, 1.25, 75.5, 100, 999.99, 1000])(
		"accepts finite percentage %s without rounding",
		(profitPercent) => {
			const result = decodeFarmSettingsChange({ profitPercent });
			expect(Result.isSuccess(result) && result.success).toEqual({
				profitPercent,
			});
		},
	);

	it.each([
		0,
		0.999,
		1000.001,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		"75",
		null,
	])("rejects invalid percentage %s", (profitPercent) => {
		expect(Result.isFailure(decodeFarmSettingsChange({ profitPercent }))).toBe(
			true,
		);
	});

	it("preserves deliberate spaces in nonblank names", () => {
		const result = decodeFarmSettingsChange({ name: "  River Farm  " });
		expect(Result.isSuccess(result) && result.success).toEqual({
			name: "  River Farm  ",
		});
	});

	it.each(["", " ", "\t\n", null, 42])(
		"rejects blank or nonstring name %j",
		(name) => {
			expect(Result.isFailure(decodeFarmSettingsChange({ name }))).toBe(true);
		},
	);

	it.each([true, false])(
		"accepts the boolean monster choice %s",
		(monsters) => {
			const result = decodeFarmSettingsChange({ monsters });
			expect(Result.isSuccess(result) && result.success).toEqual({ monsters });
		},
	);

	it.each(["Default", "Remixed"])(
		"accepts the supported mine mode %s",
		(mineRewards) => {
			const result = decodeFarmSettingsChange({ mineRewards });
			expect(Result.isSuccess(result) && result.success).toEqual({
				mineRewards,
			});
		},
	);

	it.each([
		{ monsters: "false" },
		{ monsters: 0 },
		{ mineRewards: "Normal" },
		{ mineRewards: "remixed" },
		{ mineRewards: "ModdedRewardMode" },
	])("rejects unsupported control value %j", (input) => {
		expect(Result.isFailure(decodeFarmSettingsChange(input))).toBe(true);
	});

	it("accepts missing keys as an empty change but rejects explicitly undefined values", () => {
		const empty = decodeFarmSettingsChange({});
		expect(Result.isSuccess(empty) && empty.success).toEqual({});
		for (const key of ["name", "profitPercent", "monsters", "mineRewards"]) {
			expect(
				Result.isFailure(decodeFarmSettingsChange({ [key]: undefined })),
			).toBe(true);
		}
	});

	it.each([
		{ seed: 42 },
		{ name: "Valid Farm", unexpected: true },
		null,
		[],
		"Farm",
	])("rejects malformed requests or unknown keys %j", (input) => {
		expect(Result.isFailure(decodeFarmSettingsChange(input))).toBe(true);
	});

	it("ignores inherited fields and decodes only deliberate own values", () => {
		// Prototype values are not requested edits, whether valid or invalid.
		// The decoded result must not carry them into operation property reads.
		const input = Object.assign(
			Object.create({ profitPercent: 0, monsters: true }),
			{
				name: "Own",
			},
		);
		const result = decodeFarmSettingsChange(input);
		expect(Result.isSuccess(result) && result.success).toEqual({ name: "Own" });
		if (Result.isSuccess(result)) {
			expect(result.success.monsters).toBeUndefined();
			expect(result.success.profitPercent).toBeUndefined();
		}
	});

	it("still rejects invalid own values when the prototype supplies valid alternatives", () => {
		const input = Object.assign(Object.create({ profitPercent: 75 }), {
			name: "Own",
			profitPercent: 0,
		});
		expect(Result.isFailure(decodeFarmSettingsChange(input))).toBe(true);
	});
});
