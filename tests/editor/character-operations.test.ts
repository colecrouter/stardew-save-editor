import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import {
	decodeCharacterChange,
	readCharacters,
	setCharacter,
	skillLevel,
	masteryLevel,
	skillXpForLevel,
	masteryXpForLevel,
	type CharacterChange,
} from "../../src/lib/editor/character-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture } from "./fixtures.ts";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
function fixture() {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, {
		experiencePoints: { int: [0, 101, 777, 1300, 15000, 12345], opaque: "007" },
		farmingLevel: 0,
		fishingLevel: 1,
		foragingLevel: 3,
		miningLevel: 4,
		combatLevel: 10,
		professions: { int: [0, 0, 1, 4, 999], opaque: [false, "0007"] },
		stats: {
			Values: {
				item: [
					{
						key: { string: "MasteryExp" },
						value: { unsignedInt: 25000 },
						opaque: "keep",
					},
					{ key: { string: "MasteryLevelsSpent" }, value: { unsignedInt: 2 } },
					{ key: { string: "irrelevant" }, value: { unsignedInt: 123 } },
				],
				opaque: "007",
			},
			opaque: "stats",
		},
		maxHealth: 140,
		health: 120,
		stamina: 211,
		newLevels: { Point: [{ X: 0, Y: 1 }] },
		craftingRecipes: { opaque: "no rewards" },
	});
	return document;
}
function required<A>(value: A | undefined): A {
	if (value === undefined) throw Error("Missing fixture value");
	return value;
}
const raw = (document: ReturnType<typeof fixture>) =>
	document.SaveGame.player as unknown as Record<string, unknown>;
const change = (
	value: Omit<Extract<CharacterChange, { kind: "skill-xp" }>, "farmerId">,
): CharacterChange => ({ farmerId: "host", ...value });

describe("character save operations", () => {
	it("uses the game's skill and mastery threshold tables including unsigned mastery read semantics", () => {
		skillXpForLevel.forEach((xp, level) => {
			expect(skillLevel(xp)).toBe(level);
			if (level) expect(skillLevel(xp - 1)).toBe(level - 1);
		});
		masteryXpForLevel.forEach((xp, level) => {
			expect(masteryLevel(xp)).toBe(level);
			if (level) expect(masteryLevel(xp - 1)).toBe(level - 1);
		});
		expect(masteryLevel(4294967295)).toBe(0);
	});
	it("validates requests independently and rejects inherited/excess/invalid fields", () => {
		for (const input of [
			{ farmerId: "host", kind: "skill-xp", skill: "farming", value: -1 },
			{ farmerId: "host", kind: "skill-xp", skill: "farming", value: 100000 },
			{ farmerId: "host", kind: "skill-level", skill: "farming", value: 11 },
			{ farmerId: "host", kind: "mastery-xp", value: 2147483648 },
			{ farmerId: "host", kind: "profession", profession: 30, enabled: true },
			{ farmerId: "host", kind: "profession", profession: 1, enabled: "yes" },
			{ farmerId: "host", kind: "mastery-xp", value: NaN },
			Object.create({ farmerId: "host", kind: "mastery-xp", value: 10000 }),
			{ farmerId: "host", kind: "mastery-xp", value: 10000, other: 1 },
		])
			expect(Result.isFailure(decodeCharacterChange(input))).toBe(true);
		expect(
			Result.isSuccess(
				decodeCharacterChange({
					farmerId: "host",
					kind: "mastery-xp",
					value: 2147483647,
				}),
			),
		).toBe(true);
	});
	it("projects read-only without repairing custom mirrors, profession IDs, or stat containers", () => {
		const document = fixture();
		raw(document).farmingLevel = 99;
		const before = structuredClone(document);
		const view = readCharacters(document)[0];
		expect(view?.skills[0]).toMatchObject({ xp: 0, level: 0, supported: true });
		expect(view?.professions.values).toEqual([0, 0, 1, 4, 999]);
		expect(view?.mastery).toMatchObject({
			xp: 25000,
			spent: 2,
			minXp: 25000,
			level: 2,
		});
		expect(document).toEqual(before);
	});
	it("writes XP and its level mirror only, preserves all unrelated data, and restores exact Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				yield* session.transact(
					setCharacter(
						change({ kind: "skill-xp", skill: "farming", value: 2150 }),
					),
				);
				const after = yield* session.snapshot;
				const expected = structuredClone(document);
				const owner = raw(expected);
				(owner.experiencePoints as { int: number[] }).int[0] = 2150;
				owner.farmingLevel = 5;
				expect(after.document).toEqual(expected);
				expect(after.entries[0]?.annotations[0]?.tags).toContain(
					"character:skill-xp",
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("level choices use threshold XP while unchanged XP/current derived level preserve progress and redo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				raw(document).farmingLevel = 99;
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setCharacter({
						farmerId: "host",
						kind: "skill-level",
						skill: "fishing",
						value: 10,
					}),
				);
				let after = yield* session.snapshot;
				expect(
					(raw(after.document).experiencePoints as { int: number[] }).int[1],
				).toBe(15000);
				expect(raw(after.document).fishingLevel).toBe(10);
				yield* session.undo;
				const before = yield* session.snapshot;
				yield* session.transact(
					setCharacter(
						change({ kind: "skill-xp", skill: "farming", value: 0 }),
					),
				);
				yield* session.transact(
					setCharacter({
						farmerId: "host",
						kind: "skill-level",
						skill: "fishing",
						value: 1,
					}),
				);
				after = yield* session.snapshot;
				expect(after).toEqual(before);
			}),
		));
	it("adds a secondary and missing prerequisite atomically, permits other branches, and cascades explicit parent removal", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setCharacter({
						farmerId: "host",
						kind: "profession",
						profession: 27,
						enabled: true,
					}),
				);
				let after = yield* session.snapshot;
				expect(
					(raw(after.document).professions as { int: number[] }).int,
				).toEqual([0, 0, 1, 4, 999, 24, 27]);
				// Profession editing never simulates gameplay's health refill/perk hooks.
				expect(raw(after.document).maxHealth).toBe(140);
				expect(raw(after.document).health).toBe(120);
				yield* session.transact(
					setCharacter({
						farmerId: "host",
						kind: "profession",
						profession: 0,
						enabled: false,
					}),
				);
				after = yield* session.snapshot;
				expect(
					(raw(after.document).professions as { int: number[] }).int,
				).toEqual([1, 4, 999, 24, 27]);
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
	it("keeps imported orphan/duplicate professions until an explicit affected edit and supports empty/singleton containers", () =>
		run(
			Effect.gen(function* () {
				for (const professions of ["", { int: 999, opaque: "007" }]) {
					const document = fixture();
					raw(document).professions = professions;
					const session = yield* makeHistorySession(document);
					yield* session.transact(
						setCharacter({
							farmerId: "host",
							kind: "profession",
							profession: 5,
							enabled: true,
						}),
					);
					const after = yield* session.snapshot;
					expect(
						(raw(after.document).professions as { int: number[] }).int,
					).toEqual(professions === "" ? [1, 5] : [999, 1, 5]);
					yield* session.undo;
					expect((yield* session.snapshot).document).toEqual(document);
				}
				const document = fixture();
				raw(document).professions = { int: [5, 5, 999] };
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				yield* session.transact(
					setCharacter({
						farmerId: "host",
						kind: "profession",
						profession: 5,
						enabled: true,
					}),
				);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
	it("bounds mastery by both claimed flags and spent counter, updates case-insensitive key without touching rewards", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				raw(document).stats = {
					Values: {
						item: [
							{
								key: { string: "masteryexp", opaque: "007" },
								value: { unsignedInt: 45000, other: false },
								extra: "keep",
							},
							{
								key: { string: "MasteryLevelsSpent" },
								value: { unsignedInt: 1 },
							},
							...[0, 1, 4].map((i) => ({
								key: { string: `mastery_${i}` },
								value: { unsignedInt: 1 },
							})),
						],
						opaque: "007",
					},
					other: "keep",
				};
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				expect(readCharacters(document)[0]?.mastery.minXp).toBe(45000);
				const failed = yield* Effect.result(
					session.transact(
						setCharacter({
							farmerId: "host",
							kind: "mastery-xp",
							value: 44999,
						}),
					),
				);
				expect(Result.isFailure(failed)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				yield* session.transact(
					setCharacter({ farmerId: "host", kind: "mastery-xp", value: 70000 }),
				);
				const expected = structuredClone(document);
				required(
					(
						raw(expected).stats as {
							Values: { item: { value: { unsignedInt: number } }[] };
						}
					).Values.item[0],
				).value.unsignedInt = 70000;
				expect((yield* session.snapshot).document).toEqual(expected);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
	it("allows explicit MasteryExp creation from missing/empty Values and preserves existing singleton wrappers", () =>
		run(
			Effect.gen(function* () {
				for (const stats of [
					{ opaque: "007" },
					{ Values: "", opaque: "007" },
					{
						Values: {
							item: { key: { string: "other" }, value: { unsignedInt: 7 } },
							opaque: "007",
						},
					},
				]) {
					const document = fixture();
					raw(document).stats = stats;
					const original = structuredClone(document);
					expect(readCharacters(document)[0]?.mastery.xp).toBe(0);
					expect(document).toEqual(original);
					const session = yield* makeHistorySession(document);
					yield* session.transact(
						setCharacter({
							farmerId: "host",
							kind: "mastery-xp",
							value: 10000,
						}),
					);
					expect(
						readCharacters((yield* session.snapshot).document)[0]?.mastery
							.level,
					).toBe(1);
					yield* session.undo;
					expect((yield* session.snapshot).document).toEqual(original);
				}
			}),
		));
	it("keeps missing/malformed/ambiguous fields and duplicate owners read-only without affecting other character fields", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				raw(document).experiencePoints = { int: ["bad", 100] };
				raw(document).professions = { int: [0, "mod"] };
				raw(document).stats = {
					Values: {
						item: [
							{ key: { string: "masteryExp" }, value: { unsignedInt: 1 } },
							{ key: { string: "MasteryExp" }, value: { unsignedInt: 2 } },
						],
					},
				};
				const view = readCharacters(document)[0];
				expect(view?.skills[0]?.supported).toBe(false);
				expect(view?.skills[1]?.supported).toBe(true);
				expect(view?.professions.supported).toBe(false);
				expect(view?.mastery.supported).toBe(false);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				for (const request of [
					change({ kind: "skill-xp", skill: "farming", value: 100 }),
					{
						farmerId: "host",
						kind: "profession",
						profession: 2,
						enabled: true,
					} as const,
					{ farmerId: "host", kind: "mastery-xp", value: 10000 } as const,
				])
					expect(
						Result.isFailure(
							yield* Effect.result(session.transact(setCharacter(request))),
						),
					).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				const duplicate = fixture();
				duplicate.SaveGame.farmhands = {
					Farmer: [structuredClone(duplicate.SaveGame.player)],
				};
				expect(
					readCharacters(duplicate).every((owner) => !owner.supported),
				).toBe(true);
				const duplicateSession = yield* makeHistorySession(duplicate);
				expect(
					Result.isFailure(
						yield* Effect.result(
							duplicateSession.transact(
								setCharacter(
									change({ kind: "skill-xp", skill: "farming", value: 100 }),
								),
							),
						),
					),
				).toBe(true);
			}),
		));
	it("targets the selected farmer and rolls back earlier valid edits when a later operation fails", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const guest = structuredClone(document.SaveGame.player);
				guest.UniqueMultiplayerID = "guest";
				guest.name = "Guest";
				document.SaveGame.farmhands = { Farmer: [guest] };
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const failed = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							yield* setCharacter({
								farmerId: "guest",
								kind: "skill-xp",
								skill: "mining",
								value: 99999,
							});
							yield* setCharacter({
								farmerId: "guest",
								kind: "mastery-xp",
								value: 1,
							});
						}),
					),
				);
				expect(Result.isFailure(failed)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				yield* session.transact(
					setCharacter({
						farmerId: "guest",
						kind: "skill-xp",
						skill: "mining",
						value: 99999,
					}),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toEqual(
					document.SaveGame.player,
				);
				expect(
					readCharacters(after.document)
						.find((owner) => owner.farmerId === "guest")
						?.skills.find((skill) => skill.key === "mining")?.level,
				).toBe(10);
			}),
		));
	it("preserves a malformed relevant mastery stat rather than coercing it", () => {
		for (const value of [-1, 1.5, "10", null, { opaque: true }]) {
			const document = fixture();
			raw(document).stats = {
				Values: {
					item: [
						{ key: { string: "mastery_2" }, value: { unsignedInt: value } },
					],
				},
			};
			expect(readCharacters(document)[0]?.mastery.supported).toBe(false);
		}
	});
});
