import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import { Effect, Result } from "effect";
import {
	inspectPregnancy,
	readPregnancy,
} from "../../src/lib/editor/pregnancy-data.ts";
import { setPregnancy } from "../../src/lib/editor/pregnancy-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	tinyFixture,
	parser,
	exportDocument,
} from "../helpers/editor-document.ts";

function fixture() {
	const document = tinyFixture();
	const friendship = {
		Status: "Married",
		Points: 2500,
		RoommateMarriage: false,
		WeddingDate: { Year: 1, Season: "spring", DayOfMonth: 1 },
		opaque: "007",
	};
	Object.assign(document.SaveGame, {
		year: 1,
		currentSeason: "winter",
		dayOfMonth: 25,
		locations: [
			{
				name: "FarmHouse",
				$type: "StardewValley.Locations.FarmHouse",
				cribStyle: 1,
				characters: [],
			},
		],
	});
	Object.assign(document.SaveGame.player, {
		homeLocation: "FarmHouse",
		houseUpgradeLevel: 2,
		friendshipData: [{ key: "Abigail", value: friendship }],
	});
	return { document, friendship };
}

describe("saved pregnancy and baby-question eligibility", () => {
	it("projects saved facts without edits and separates eligibility from runtime chance", () => {
		const { document } = fixture(),
			before = structuredClone(document);
		const view = readPregnancy(document, "1");
		expect(view).toMatchObject({
			kind: "villager",
			spouse: "Abigail",
			supported: true,
			expecting: false,
			eligible: true,
		});
		expect(document).toEqual(before);
		Object.assign(document.SaveGame.player, { divorceTonight: true });
		expect(readPregnancy(document, "1").eligible).toBe(false);
	});
	it.effect(
		"retains exact target and date changes through Undo/Redo and XML",
		() =>
			Effect.gen(function* () {
				const { document } = fixture();
				const before = structuredClone(document);
				const session = yield* makeHistorySession(document);
				const targetKey = readPregnancy(document, "1").targetKey;
				if (!targetKey) throw Error("Missing fixture spouse");
				yield* session.transact(
					setPregnancy({ farmerId: "1", targetKey, expecting: true }),
				);
				const after = yield* session.snapshot;
				expect(readPregnancy(after.document, "1")).toMatchObject({
					expecting: true,
					daysUntilBirth: 14,
					dueDate: "Thursday, Spring 11, Year 2",
				});
				expect(
					readPregnancy(parser.parse(exportDocument(after.document)), "1")
						.daysUntilBirth,
				).toBe(14);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
				yield* session.transact(
					setPregnancy({ farmerId: "1", targetKey, expecting: false }),
				);
				expect(
					readPregnancy((yield* session.snapshot).document, "1").expecting,
				).toBe(false);
			}),
		30_000,
	);
	it.effect(
		"rejects stale couples, invalid days, duplicate spouses and malformed due dates atomically",
		() =>
			Effect.gen(function* () {
				const { document } = fixture();
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const targetKey = readPregnancy(document, "1").targetKey ?? "";
				for (const request of [
					{ farmerId: "1", targetKey: "other", expecting: true },
					{ farmerId: "1", targetKey, expecting: true, days: 0 },
					{ farmerId: "1", targetKey, expecting: true, days: 1.5 },
				])
					expect(
						Result.isFailure(
							yield* Effect.result(session.transact(setPregnancy(request))),
						),
					).toBe(true);
				expect((yield* session.snapshot).document).toEqual(before.document);
				const malformed = fixture();
				Object.assign(malformed.friendship, {
					NextBirthingDate: { Year: 2, Season: "spring", DayOfMonth: 99 },
				});
				expect(readPregnancy(malformed.document, "1")).toMatchObject({
					supported: false,
					expecting: true,
				});
				Object.assign(document.SaveGame.player, {
					friendshipData: [
						{
							key: "Abigail",
							value: fixture().friendship,
						},
						{
							key: "Abigail",
							value: fixture().friendship,
						},
					],
				});
				expect(readPregnancy(document, "1").supported).toBe(false);
			}),
	);
	it.effect(
		"checks one actual eligible home for player marriages and requires toddlers",
		() =>
			Effect.gen(function* () {
				const { document } = fixture();
				Object.assign(document.SaveGame.player, { friendshipData: [] });
				const guest = !Array.isArray(document.SaveGame.farmhands)
					? undefined
					: document.SaveGame.farmhands[0];
				if (!guest) throw Error("Missing guest");
				Object.assign(guest, { homeLocation: "Cabin_1", houseUpgradeLevel: 2 });
				Object.assign(document.SaveGame, {
					farmerFriendships: [
						{ key: { Farmer1: 2n, Farmer2: 1n }, value: { Status: "Married" } },
					],
					locations: [
						{
							name: "FarmHouse",
							$type: "StardewValley.Locations.FarmHouse",
							cribStyle: 0,
							characters: [],
						},
						{
							name: "Farm",
							buildings: [
								{
									indoors: {
										$type: "StardewValley.Locations.Cabin",
										uniqueName: "Cabin_1",
										cribStyle: 1,
										characters: [
											{ $type: "StardewValley.Characters.Child", daysOld: 54 },
										],
									},
								},
							],
						},
					],
				});
				expect(readPregnancy(document, "1")).toMatchObject({
					kind: "player",
					spouse: "Guest",
					eligible: false,
				});
				const game: Record<string, unknown> = document.SaveGame;
				Object.assign(game, {
					locations: [
						{
							name: "Cabin_1",
							cribStyle: 1,
							characters: [
								{ $type: "StardewValley.Characters.Child", daysOld: 55 },
							],
						},
					],
				});
				expect(readPregnancy(document, "1").eligible).toBe(true);
				yield* Effect.scoped(
					Effect.gen(function* () {
						const session = yield* makeHistorySession(document);
						const hostKey = readPregnancy(document, "1").targetKey ?? "";
						yield* session.transact(
							setPregnancy({
								farmerId: "1",
								targetKey: hostKey,
								expecting: true,
							}),
						);
						const expecting = (yield* session.snapshot).document;
						expect(readPregnancy(expecting, "1").daysUntilBirth).toBe(14);
						expect(readPregnancy(expecting, "2").daysUntilBirth).toBe(14);
						const guestKey = readPregnancy(expecting, "2").targetKey ?? "";
						yield* session.transact(
							setPregnancy({
								farmerId: "2",
								targetKey: guestKey,
								expecting: false,
							}),
						);
						expect(
							readPregnancy((yield* session.snapshot).document, "1").expecting,
						).toBe(false);
						yield* session.undo;
						expect((yield* session.snapshot).document).toEqual(expecting);
						// A reversed duplicate key is still the same couple even when the
						// duplicate claims Friendly status. Reject without picking a winner.
						const ambiguous = structuredClone(document);
						Object.assign(ambiguous.SaveGame, {
							farmerFriendships: [
								{
									key: { Farmer1: "1", Farmer2: "2" },
									value: { Status: "Married" },
								},
								{
									key: { Farmer1: "2", Farmer2: "1" },
									value: { Status: "Friendly" },
								},
							],
						});
						const duplicateSession = yield* makeHistorySession(ambiguous);
						expect(
							Result.isFailure(
								yield* Effect.result(
									duplicateSession.transact(
										setPregnancy({
											farmerId: "1",
											targetKey: hostKey,
											expecting: true,
										}),
									),
								),
							),
						).toBe(true);
						const unchanged = yield* duplicateSession.snapshot;
						expect(unchanged.document).toEqual(ambiguous);
						expect(unchanged.entries).toHaveLength(0);
					}),
				);
			}),
	);
	it.effect(
		"turns an explicitly nil saved date into an ordinary date without losing opaque data",
		() =>
			Effect.gen(function* () {
				const { document, friendship } = fixture();
				Object.assign(friendship, {
					NextBirthingDate: null,
					dateMetadata: "keep",
				});
				expect(readPregnancy(document, "1")).toMatchObject({
					expecting: false,
					dueDate: undefined,
					daysUntilBirth: undefined,
				});
				const before = structuredClone(document);
				const session = yield* makeHistorySession(document);
				const targetKey = readPregnancy(document, "1").targetKey ?? "";
				yield* session.transact(
					setPregnancy({
						farmerId: "1",
						targetKey,
						expecting: true,
						days: 2,
					}),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toMatchObject({
					friendshipData: [
						{
							value: {
								NextBirthingDate: {
									Year: 1,
									Season: "winter",
									DayOfMonth: 27,
								},
							},
						},
					],
				});
				expect(
					inspectPregnancy(after.document, "1").saved?.NextBirthingDate,
				).toEqual({
					Year: 1,
					Season: "winter",
					DayOfMonth: 27,
				});
				expect(
					readPregnancy(parser.parse(exportDocument(after.document)), "1")
						.daysUntilBirth,
				).toBe(2);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before);
			}),
		30_000,
	);
});
