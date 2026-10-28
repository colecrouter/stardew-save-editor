import { Effect, Exit, Fiber, Result } from "effect";
import { describe, expect, it } from "vitest";
import {
	prepareTrinketPropertyChange,
	readTrinketProperties,
	type TrinketPropertyChange,
} from "../../src/lib/editor/trinket-properties";
import {
	createRandom,
	rollTrinket,
	statSaveFields,
	type TrinketKind,
	type TrinketRollContext,
} from "../../src/lib/TrinketStats";

const ctx: TrinketRollContext = {
	useLegacyRandom: false,
	totalMoneyEarned: 3000000,
};
const rawItem = (kind: TrinketKind, generationSeed = 0) => ({
	"@_xsi:type": "Trinket",
	itemId: kind,
	generationSeed,
	modData: { opaque: "007" },
});
const request = <P extends TrinketPropertyChange["property"]>(
	property: P,
	value: Extract<TrinketPropertyChange, { property: P }>["value"],
) =>
	({ farmerId: "host", entityId: "item:1", property, value }) as Extract<
		TrinketPropertyChange,
		{ property: P }
	>;
const prepare = (raw: unknown, change: TrinketPropertyChange, context = ctx) =>
	Effect.runPromise(prepareTrinketPropertyChange(raw, change, context));

describe("proxy-free trinket property policy", () => {
	it("derives each supported family's controls from its existing seed without modifying saved data", () => {
		for (const kind of [
			"FairyBox",
			"ParrotEgg",
			"IceRod",
			"IridiumSpur",
			"MagicQuiver",
			"FrogEgg",
		] as const) {
			const raw = Object.freeze(rawItem(kind));
			const before = structuredClone(raw);
			expect(readTrinketProperties(raw, ctx).length).toBeGreaterThan(0);
			expect(raw).toEqual(before);
		}
		for (const raw of [
			undefined,
			{ "@_xsi:type": "Trinket", itemId: "FairyBox" },
			{ ...rawItem("FairyBox"), generationSeed: "4" },
			{ ...rawItem("FairyBox"), itemId: "ModdedTrinket" },
		]) {
			expect(readTrinketProperties(raw, ctx)).toEqual([]);
		}
	});

	it.each([false, true])(
		"selects a seed that the game rolls into the requested level (legacy=%s)",
		async (useLegacyRandom) => {
			const context = { ...ctx, useLegacyRandom };
			const raw = rawItem("FairyBox", 751922);
			const original = structuredClone(raw);
			const current = rollTrinket(
				"FairyBox",
				createRandom(raw.generationSeed, useLegacyRandom),
				context,
			);
			if (current.kind !== "FairyBox") throw Error("Expected Fairy Box");
			const level = current.level === 5 ? 4 : 5;
			const patch = await prepare(
				raw,
				request("trinket:level", level),
				context,
			);
			expect(
				rollTrinket(
					"FairyBox",
					createRandom(patch.generationSeed as number, useLegacyRandom),
					context,
				),
			).toMatchObject({ level });
			expect(patch.descriptionSubstitutionTemplates).toEqual({ string: level });
			expect(Object.keys(patch).sort()).toEqual([
				"descriptionSubstitutionTemplates",
				"generationSeed",
			]);
			expect(raw).toEqual(original);
		},
	);

	it("does not reseed or refresh templates for a no-op", async () => {
		const raw = {
			...rawItem("FairyBox"),
			descriptionSubstitutionTemplates: { custom: "retain" },
		};
		const field = readTrinketProperties(raw, ctx)[0];
		if (!field || typeof field.value !== "number")
			throw Error("Expected numeric level");
		expect(await prepare(raw, request("trinket:level", field.value))).toEqual(
			{},
		);
		expect(raw.descriptionSubstitutionTemplates).toEqual({ custom: "retain" });
		const quiver = rawItem("MagicQuiver", 1);
		const type = readTrinketProperties(quiver, ctx).find(
			(field) => field.property === "trinket:type",
		)?.value;
		if (
			type !== "normal" &&
			type !== "rapid" &&
			type !== "heavy" &&
			type !== "perfect"
		)
			throw Error("Expected quiver type");
		expect(await prepare(quiver, request("trinket:type", type))).toEqual({});
	});

	it("validates the current owner's Parrot cap rather than clamping an invalid request", async () => {
		const raw = rawItem("ParrotEgg");
		const low = { ...ctx, totalMoneyEarned: 0 };
		expect(readTrinketProperties(raw, low)[0]).toMatchObject({
			min: 1,
			max: 1,
			value: 1,
		});
		const rejected = await Effect.runPromise(
			Effect.result(
				prepareTrinketPropertyChange(raw, request("trinket:level", 2), low),
			),
		);
		expect(Result.isFailure(rejected)).toBe(true);
		const patch = await prepare(raw, request("trinket:level", 4));
		expect(
			rollTrinket(
				"ParrotEgg",
				createRandom(patch.generationSeed as number, false),
				ctx,
			),
		).toMatchObject({ level: 4 });
	});

	it("coordinates a quiver type change and mirrors the actual roll's name/templates", async () => {
		const raw = rawItem("MagicQuiver", 1);
		const patch = await prepare(raw, request("trinket:type", "perfect"));
		const rolled = rollTrinket(
			"MagicQuiver",
			createRandom(patch.generationSeed as number, false),
			ctx,
		);
		expect(rolled).toMatchObject({
			type: "perfect",
			minDamage: 30,
			maxDamage: 35,
			delay: 0.9,
		});
		const fields = statSaveFields(rolled);
		expect(patch.descriptionSubstitutionTemplates).toEqual({
			string: fields.templates,
		});
		expect(patch.displayNameOverrideTemplate).toEqual({
			string: fields.displayName,
		});
	});

	it("changes Frog color through its seed without adding unrelated description templates", async () => {
		const raw = rawItem("FrogEgg");
		const field = readTrinketProperties(raw, ctx)[0];
		const variant = field?.value === 7 ? 6 : 7;
		const patch = await prepare(raw, request("trinket:variant", variant));
		expect(
			rollTrinket(
				"FrogEgg",
				createRandom(patch.generationSeed as number, false),
				ctx,
			),
		).toMatchObject({ variant });
		expect(patch).not.toHaveProperty("descriptionSubstitutionTemplates");
		expect(patch.displayNameOverrideTemplate).toBeTruthy();
	});

	it("uses the actual Ice Rod perfect flag when changing a rolled field", async () => {
		const raw = rawItem("IceRod");
		const patch = await prepare(raw, request("trinket:interval", 3.3));
		const rolled = rollTrinket(
			"IceRod",
			createRandom(patch.generationSeed as number, false),
			ctx,
		);
		expect(rolled).toMatchObject({ interval: 3.3, perfect: false });
		expect(patch.displayNameOverrideTemplate).toEqual({
			string: { "@_xsi:nil": "true" },
		});
	});

	it("allows a rare seed search to be interrupted between bounded batches", async () => {
		// This heavy-quiver roll needs 1,329 candidates for damage 38 while keeping
		// its 1.9-second delay, ensuring a started search reaches a batch boundary.
		const raw = rawItem("MagicQuiver", 22);
		const before = structuredClone(raw);
		const exit = await Effect.runPromise(
			Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					prepareTrinketPropertyChange(
						raw,
						request("trinket:minDamage", 38),
						ctx,
					),
					{ startImmediately: true },
				);
				yield* Fiber.interrupt(fiber);
				return yield* Fiber.await(fiber);
			}),
		);
		expect(Exit.hasInterrupts(exit)).toBe(true);
		expect(raw).toEqual(before);
	});

	it("rejects invalid ranges, incompatible fields and unknown/missing seeds without mutating them", async () => {
		for (const [raw, change] of [
			[rawItem("FairyBox"), request("trinket:level", 0)],
			[rawItem("FairyBox"), request("trinket:freeze", 2)],
			[rawItem("IceRod"), request("trinket:interval", 3.33)],
			[rawItem("MagicQuiver"), request("trinket:minDamage", 999)],
			[rawItem("MagicQuiver", 1), request("trinket:delay", 0.65)],
			[
				{ ...rawItem("FairyBox"), generationSeed: undefined },
				request("trinket:level", 2),
			],
		] as const) {
			const before = structuredClone(raw);
			const result = await Effect.runPromise(
				Effect.result(prepareTrinketPropertyChange(raw, change, ctx)),
			);
			expect(Result.isFailure(result)).toBe(true);
			expect(raw).toEqual(before);
		}
	});
});
