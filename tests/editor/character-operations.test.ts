import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
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
import { tinyFixture } from "../helpers/editor-document.ts";

function fixture() {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, {
		experiencePoints: [0, 101, 777, 1300, 15000, 12345],
		testMetadataexperiencePoints: { opaque: "007" },
		farmingLevel: 0,
		fishingLevel: 1,
		foragingLevel: 3,
		miningLevel: 4,
		combatLevel: 10,
		professions: [0, 0, 1, 4, 999],
		testMetadataprofessions: { opaque: [false, "0007"] },
		stats: {
			Values: [
				{
					key: "MasteryExp",
					value: 25000,
					opaque: "keep",
				},
				{ key: "MasteryLevelsSpent", value: 2 },
				{ key: "irrelevant", value: 123 },
			],
			testMetadataValues: { opaque: "007" },
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
const raw = (document: import("../../src/lib/editor/domain.ts").SaveDocument) =>
	document.SaveGame.player as unknown as Record<string, unknown>;
const change = (
	value: Omit<Extract<CharacterChange, { kind: "skill-xp" }>, "farmerId">,
): CharacterChange => ({ farmerId: "1", ...value });

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
			{ farmerId: "1", kind: "skill-xp", skill: "farming", value: -1 },
			{ farmerId: "1", kind: "skill-xp", skill: "farming", value: 100000 },
			{ farmerId: "1", kind: "skill-level", skill: "farming", value: 11 },
			{ farmerId: "1", kind: "mastery-xp", value: 2147483648 },
			{ farmerId: "1", kind: "profession", profession: 30, enabled: true },
			{ farmerId: "1", kind: "profession", profession: 1, enabled: "yes" },
			{ farmerId: "1", kind: "mastery-xp", value: NaN },
			Object.create({ farmerId: "1", kind: "mastery-xp", value: 10000 }),
			{ farmerId: "1", kind: "mastery-xp", value: 10000, other: 1 },
		])
			expect(Result.isFailure(decodeCharacterChange(input))).toBe(true);
		expect(
			Result.isSuccess(
				decodeCharacterChange({
					farmerId: "1",
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
	it.effect(
		"writes XP and its level mirror only, preserves all unrelated data, and restores exact Undo/Redo",
		() =>
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
				(owner.experiencePoints as number[])[0] = 2150;
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
	);
	it.effect(
		"level choices use threshold XP while unchanged XP/current derived level preserve progress and redo",
		() =>
			Effect.gen(function* () {
				const document = fixture();
				raw(document).farmingLevel = 99;
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setCharacter({
						farmerId: "1",
						kind: "skill-level",
						skill: "fishing",
						value: 10,
					}),
				);
				let after = yield* session.snapshot;
				expect((raw(after.document).experiencePoints as number[])[1]).toBe(
					15000,
				);
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
						farmerId: "1",
						kind: "skill-level",
						skill: "fishing",
						value: 1,
					}),
				);
				after = yield* session.snapshot;
				expect(after).toEqual(before);
			}),
	);
	it.effect(
		"adds a secondary and missing prerequisite atomically, permits other branches, and cascades explicit parent removal",
		() =>
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setCharacter({
						farmerId: "1",
						kind: "profession",
						profession: 27,
						enabled: true,
					}),
				);
				let after = yield* session.snapshot;
				expect(raw(after.document).professions as number[]).toEqual([
					0, 0, 1, 4, 999, 24, 27,
				]);
				// Profession editing never simulates gameplay's health refill/perk hooks.
				expect(raw(after.document).maxHealth).toBe(140);
				expect(raw(after.document).health).toBe(120);
				yield* session.transact(
					setCharacter({
						farmerId: "1",
						kind: "profession",
						profession: 0,
						enabled: false,
					}),
				);
				after = yield* session.snapshot;
				expect(raw(after.document).professions as number[]).toEqual([
					1, 4, 999, 24, 27,
				]);
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
			}),
	);
	it.effect(
		"keeps imported orphan/duplicate professions until an explicit affected edit and supports empty/singleton containers",
		() =>
			Effect.gen(function* () {
				for (const professions of [[], [999]]) {
					const document = fixture();
					raw(document).professions = professions;
					const session = yield* makeHistorySession(document);
					yield* session.transact(
						setCharacter({
							farmerId: "1",
							kind: "profession",
							profession: 5,
							enabled: true,
						}),
					);
					const after = yield* session.snapshot;
					expect(raw(after.document).professions as number[]).toEqual(
						professions.length === 0 ? [1, 5] : [999, 1, 5],
					);
					yield* session.undo;
					expect((yield* session.snapshot).document).toEqual(document);
				}
				const document = fixture();
				raw(document).professions = [5, 5, 999];
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				yield* session.transact(
					setCharacter({
						farmerId: "1",
						kind: "profession",
						profession: 5,
						enabled: true,
					}),
				);
				expect(yield* session.snapshot).toEqual(before);
			}),
	);
	it.effect(
		"bounds mastery by both claimed flags and spent counter, updates case-insensitive key without touching rewards",
		() =>
			Effect.gen(function* () {
				const document = fixture();
				raw(document).stats = {
					Values: [
						{
							key: "masteryexp",
							keyMetadata: "007",
							value: 45000,
							valueMetadata: false,
							extra: "keep",
						},
						{
							key: "MasteryLevelsSpent",
							value: 1,
						},
						...[0, 1, 4].map((i) => ({
							key: `mastery_${i}`,
							value: 1,
						})),
					],
					testMetadataValues: { opaque: "007" },
					other: "keep",
				};
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				expect(readCharacters(document)[0]?.mastery.minXp).toBe(45000);
				const failed = yield* Effect.result(
					session.transact(
						setCharacter({
							farmerId: "1",
							kind: "mastery-xp",
							value: 44999,
						}),
					),
				);
				expect(Result.isFailure(failed)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				yield* session.transact(
					setCharacter({ farmerId: "1", kind: "mastery-xp", value: 70000 }),
				);
				const expected = structuredClone(document);
				required(
					(
						raw(expected).stats as {
							Values: { value: number }[];
						}
					).Values[0],
				).value = 70000;
				expect((yield* session.snapshot).document).toEqual(expected);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
			}),
	);
	it.effect(
		"allows explicit MasteryExp creation from missing/empty Values and preserves existing singleton wrappers",
		() =>
			Effect.gen(function* () {
				for (const stats of [
					{ opaque: "007" },
					{ Values: [], opaque: "007" },
					{
						Values: [{ key: "other", value: 7 }],
						testMetadataValues: { opaque: "007" },
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
							farmerId: "1",
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
	);
	it.effect(
		"keeps missing fields, invalid game values and ambiguous identities read-only",
		() =>
			Effect.gen(function* () {
				const document = fixture();
				raw(document).experiencePoints = [-1, 100];
				delete raw(document).professions;
				raw(document).stats = {
					Values: [
						{ key: "masteryExp", value: 1 },
						{ key: "MasteryExp", value: 2 },
					],
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
						farmerId: "1",
						kind: "profession",
						profession: 2,
						enabled: true,
					} as const,
					{ farmerId: "1", kind: "mastery-xp", value: 10000 } as const,
				])
					expect(
						Result.isFailure(
							yield* Effect.result(session.transact(setCharacter(request))),
						),
					).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				const duplicate = fixture();
				duplicate.SaveGame.farmhands = [
					structuredClone(duplicate.SaveGame.player),
				];
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
	);
	it.effect(
		"targets the selected farmer and rolls back earlier valid edits when a later operation fails",
		() =>
			Effect.gen(function* () {
				const document = fixture();
				const guest = structuredClone(document.SaveGame.player);
				guest.UniqueMultiplayerID = 2n;
				guest.name = "Guest";
				document.SaveGame.farmhands = [guest];
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const failed = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							yield* setCharacter({
								farmerId: "2",
								kind: "skill-xp",
								skill: "mining",
								value: 99999,
							});
							yield* setCharacter({
								farmerId: "2",
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
						farmerId: "2",
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
						.find((owner) => owner.farmerId === "2")
						?.skills.find((skill) => skill.key === "mining")?.level,
				).toBe(10);
			}),
	);
	it("preserves a malformed relevant mastery stat rather than coercing it", () => {
		for (const value of [-1, 1.5, "10", null, { opaque: true }]) {
			const document = fixture();
			raw(document).stats = {
				Values: [{ key: "mastery_2", value: value }],
			};
			expect(readCharacters(document)[0]?.mastery.supported).toBe(false);
		}
	});
});
