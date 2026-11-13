import type { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import type { ReviewJournal } from "../../src/lib/editor/transaction-annotations.ts";
import type { InventoryEdits } from "../../src/lib/editor/inventory-operations.ts";
import { Effect, Scope } from "effect";
import { describe, it, expect } from "vitest";
import {
	tinyFixture,
	exportDocument,
	parser,
} from "../helpers/editor-document.ts";
import {
	type HistorySession,
	makeHistorySession,
} from "../../src/lib/editor/history.ts";
import {
	setQuest,
	readQuestJournals,
} from "../../src/lib/editor/quest-operations.ts";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";
const baseQuest = (extra: Record<string, unknown> = {}) =>
	Object.fromEntries(
		Object.entries({
			$type: "StardewValley.Quests.Quest",
			_questTitle: "Test quest",
			_questDescription: "Description",
			_currentObjective: "Objective",
			id: "custom",
			completed: false,
			dailyQuest: false,
			destroy: false,
			canBeCancelled: true,
			moneyReward: 100,
			daysLeft: 0,
			questType: 1,
			nextQuests: [],
			...extra,
		}).filter(([, value]) => value !== undefined),
	);
function fixture(quests: unknown[] = [baseQuest()]) {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, {
		questLog: quests,
		testMetadataquestLog: { opaque: "journal" },
		mailReceived: [],
		activeDialogueEvents: [],
		previousActiveDialogueEvents: [],
		stats: { Values: [] },
		items: Array.from({ length: 12 }, () => null),
	});
	return document;
}
const target = (document: SaveDocument) => {
	const row = readQuestJournals(document)[0]?.quests[0];
	if (!row) throw new Error("Missing quest");
	return { farmerId: "1", questKey: row.key };
};
const run = <A, E>(program: Effect.Effect<A, E, Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(program));
// Capture the domain value inside the history program; it is observable only
// after the enclosing transaction has published successfully.
const transactValue = <A, E>(
	session: HistorySession,
	program: Effect.Effect<
		A,
		E,
		TransactionDraft | ReviewJournal | InventoryEdits
	>,
) =>
	Effect.gen(function* () {
		let value: A | undefined;
		yield* session.transact(
			Effect.tap(program, (next) =>
				Effect.sync(() => {
					value = next;
				}),
			),
		);
		return value;
	});
describe("quest journal operations", () => {
	it("reads without normalization and updates rewards while preserving advertised text and opaque fields", () =>
		run(
			Effect.gen(function* () {
				const document = fixture([
					baseQuest({
						$type: "StardewValley.Quests.FishingQuest",
						id: undefined,
						dailyQuest: true,
						reward: 250,
						moneyReward: -1,
						daysLeft: 2,
						target: "Willy",
						parts: [
							{
								xmlKey: "Strings:FishingQuest.cs.13274",
								param: [
									{
										$type: "System.Int32",
										value: 250,
										opaque: "keep",
									},
								],
							},
						],
						opaque: "quest",
					}),
				]);
				const before = structuredClone(document);
				const row = readQuestJournals(document)[0]?.quests[0];
				expect(document).toEqual(before);
				expect(row?.reward).toBe(250);
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setQuest({ ...target(document), kind: "reward", value: 500 }),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toMatchObject({
					questLog: [
						{
							reward: 500,
							moneyReward: -1,
							parts: [
								{
									param: [{ value: 500, opaque: "keep" }],
								},
							],
							opaque: "quest",
						},
					],
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("completes story follow-ups atomically, leaves gold pending and never grants cash", () =>
		run(
			Effect.gen(function* () {
				const document = fixture([baseQuest({ id: "6", nextQuests: ["7"] })]);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const result = yield* transactValue(
					session,
					setQuest({ ...target(document), kind: "complete" }),
				);
				expect(result?.started).toContain("Raising Animals");
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.money).toBe(
					before.document.SaveGame.player.money,
				);
				expect(
					readQuestJournals(after.document)[0]?.quests.find(
						(q) => q.key === "id:6",
					)?.completed,
				).toBe(true);
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("completes Help Wanted with stats, mail and Prize Ticket in one exact Undo step", () =>
		run(
			Effect.gen(function* () {
				const document = fixture([
					baseQuest({
						id: undefined,
						dailyQuest: true,
						questType: 7,
						$type: "StardewValley.Quests.FishingQuest",
						target: "Willy",
						reward: 300,
						moneyReward: -1,
						daysLeft: 2,
					}),
				]);
				Object.assign(document.SaveGame.player, {
					stats: {
						Values: [
							{
								key: "billboardQUESTSdone",
								value: 2,
								opaque: "stat",
							},
						],
					},
				});
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const result = yield* transactValue(
					session,
					setQuest({ ...target(document), kind: "complete" }),
				);
				expect(result?.prizeTickets).toEqual(["added"]);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toMatchObject({
					questLog: [{ completed: true, moneyReward: 300 }],
					mailReceived: ["completedFirstBillboardQuest"],
					stats: {
						Values: [
							{
								key: "billboardQUESTSdone",
								value: 3,
								opaque: "stat",
							},
							{
								key: "questsCompleted",
								value: 1,
							},
						],
					},
				});
				expect(after.document.SaveGame.player.items[0]).toMatchObject({
					itemId: "PrizeTicket",
					stack: 1,
				});
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				expect((yield* session.snapshot).identities).toEqual(before.identities);
				yield* session.redo;
				expect((yield* session.snapshot).identities).toEqual(after.identities);
			}),
		));
	it("reports a full safe backpack without discarding any item, and protects opaque nil markers", () =>
		run(
			Effect.gen(function* () {
				const document = fixture([
					baseQuest({ id: undefined, dailyQuest: true }),
				]);
				Object.assign(document.SaveGame.player, {
					stats: {
						Values: [
							{
								key: "BillboardQuestsDone",
								value: 2,
							},
						],
					},
					items: Array.from({ length: 12 }, () => ({
						"@_xsi:nil": "true",
						opaque: "keep",
					})),
				});
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const result = yield* transactValue(
					session,
					setQuest({ ...target(document), kind: "complete" }),
				);
				expect(result?.prizeTickets).toEqual(["noRoom"]);
				expect(
					(yield* session.snapshot).document.SaveGame.player.items,
				).toEqual(before.document.SaveGame.player.items);
			}),
		));
	it("removes rewardless and secret quests, including the secret replacement, without inappropriate stats", () =>
		run(
			Effect.gen(function* () {
				const document = fixture([
					baseQuest({ id: "old", moneyReward: 100 }),
					baseQuest({
						id: "secret",
						$type: "StardewValley.Quests.SecretLostItemQuest",
						exclusiveQuestId: "old",
						friendshipReward: 100,
						dailyQuest: true,
					}),
				]);
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setQuest({ ...target(document), kind: "complete" }),
				);
				expect(
					readQuestJournals((yield* session.snapshot).document)[0]?.quests,
				).toEqual([]);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({ stats: { Values: [] }, mailReceived: [] });
				const plain = fixture([baseQuest({ id: undefined, moneyReward: 0 })]);
				const noReward = yield* makeHistorySession(plain);
				yield* noReward.transact(
					setQuest({ ...target(plain), kind: "complete" }),
				);
				expect(
					readQuestJournals((yield* noReward.snapshot).document)[0]?.quests,
				).toEqual([]);
			}),
		));
	it("skips Meadowlands coop follow-up, recursively completes constructed buildings and guards opaque stats/mail", () =>
		run(
			Effect.gen(function* () {
				const document = fixture([baseQuest({ id: "6", nextQuests: ["7"] })]);
				Object.assign(document.SaveGame, { whichFarm: "MeadowlandsFarm" });
				const session = yield* makeHistorySession(document);
				const result = yield* transactValue(
					session,
					setQuest({ ...target(document), kind: "complete" }),
				);
				expect(result?.started).toEqual([]);
				for (const extra of [
					{ mailReceived: null },
					{
						stats: {
							Values: [
								{
									key: "BillboardQuestsDone",
									value: 1,
								},
								{
									key: "billboardquestsdone",
									value: 2,
								},
							],
						},
					},
					{ questLog: [baseQuest({ dailyQuest: "true" })] },
				]) {
					const invalid = fixture([
						baseQuest({ id: undefined, dailyQuest: true }),
					]);
					Object.assign(invalid.SaveGame.player, extra);
					const rejection = yield* makeHistorySession(invalid);
					const before = yield* rejection.snapshot;
					const outcome = yield* Effect.result(
						rejection.transact(
							setQuest({ ...target(invalid), kind: "complete" }),
						),
					);
					expect(outcome._tag).toBe("Failure");
					expect((yield* rejection.snapshot).document).toEqual(before.document);
				}
			}),
		));
	it("rejects duplicate targets and stale removed quests; unique field identities survive edits", () =>
		run(
			Effect.gen(function* () {
				const duplicated = fixture([baseQuest(), baseQuest()]);
				expect(
					readQuestJournals(duplicated)[0]?.quests.every(
						(row) => !row.supported,
					),
				).toBe(true);
				expect(
					new Set(
						readQuestJournals(duplicated)[0]?.quests.map(
							(row) => row.renderKey,
						),
					).size,
				).toBe(2);
				const session = yield* makeHistorySession(duplicated);
				expect(
					(yield* Effect.result(
						session.transact(
							setQuest({ ...target(duplicated), kind: "remove" }),
						),
					))._tag,
				).toBe("Failure");
				const single = fixture([
					baseQuest({ id: undefined, dailyQuest: true, daysLeft: 2 }),
				]);
				const edits = yield* makeHistorySession(single);
				const captured = target(single);
				yield* edits.transact(
					setQuest({ ...captured, kind: "reward", value: 500 }),
				);
				expect(target((yield* edits.snapshot).document)).toEqual(captured);
				yield* edits.transact(
					setQuest({ ...captured, kind: "days", value: 3 }),
				);
				yield* edits.transact(setQuest({ ...captured, kind: "remove" }));
				expect(
					(yield* Effect.result(
						edits.transact(setQuest({ ...captured, kind: "complete" })),
					))._tag,
				).toBe("Failure");
			}),
		));
	it(
		"keeps malformed/singleton journals visible without opening writes and roundtrips supported fields",
		() =>
			run(
				Effect.gen(function* () {
					const document = fixture();
					Object.assign(document.SaveGame.player, {
						questLog: [baseQuest()],
						testMetadataquestLog: { opaque: "keep" },
					});
					const session = yield* makeHistorySession(document);
					yield* session.transact(
						setQuest({ ...target(document), kind: "reward", value: 123 }),
					);
					const after = (yield* session.snapshot).document;
					expect(
						readQuestJournals(parser.parse(exportDocument(after)))[0]?.quests[0]
							?.reward,
					).toBe(123);
					for (const log of [null, false, { opaque: "invalid container" }]) {
						const invalid = fixture();
						Object.assign(invalid.SaveGame.player, { questLog: log });
						expect(readQuestJournals(invalid)[0]?.supported).toBe(false);
					}
				}),
			),
		30_000,
	);
});

it("recursively completes constructed-building follow-ups and records Emily's one-time dialogue", () =>
	run(
		Effect.gen(function* () {
			const document = fixture([
				baseQuest({
					id: "parent",
					moneyReward: 0,
					nextQuests: ["7", "126", "Unsupported.Mod"],
				}),
			]);
			Object.assign(document.SaveGame, {
				constructedBuildings: ["Coop"],
			});
			const session = yield* makeHistorySession(document);
			const result = yield* transactValue(
				session,
				setQuest({ ...target(document), kind: "complete" }),
			);
			expect(result?.started).toContain("Raising Animals");
			expect(result?.skippedFollowUps).toContain("Errand for your Wife");
			expect(result?.skippedFollowUps).toContain("Quest #Unsupported.Mod");
			expect(
				readQuestJournals((yield* session.snapshot).document)[0]?.quests.find(
					(row) => row.key === "id:7",
				)?.completed,
			).toBe(true);
			const emily = fixture([baseQuest({ id: "126", moneyReward: 0 })]);
			const marriage = yield* makeHistorySession(emily);
			yield* marriage.transact(
				setQuest({ ...target(emily), kind: "complete" }),
			);
			expect((yield* marriage.snapshot).document.SaveGame.player).toMatchObject(
				{
					mailReceived: ["emilyFiber"],
					activeDialogueEvents: [
						{ key: "emilyFiber", value: 2 },
						{ key: "questComplete_126", value: 4 },
					],
				},
			);
		}),
	));

it("keeps host-only future follow-ups out of farmhand-created quests", () =>
	run(
		Effect.gen(function* () {
			const document = fixture([
				baseQuest({ id: "parent", nextQuests: ["6"] }),
			]);
			const guest =
				document.SaveGame.farmhands && document.SaveGame.farmhands[0];
			if (!guest) throw new Error("Missing guest");
			Object.assign(guest, {
				questLog: [baseQuest({ id: "guest-parent", nextQuests: ["6"] })],
				activeDialogueEvents: [],
				previousActiveDialogueEvents: [],
			});
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setQuest({ ...target(document), kind: "complete" }),
			);
			const guestRow = readQuestJournals(
				(yield* session.snapshot).document,
			).find((owner) => owner.farmerId === "2")?.quests[0];
			if (!guestRow) throw new Error("Missing guest quest");
			yield* session.transact(
				setQuest({
					farmerId: "2",
					questKey: guestRow.key,
					kind: "complete",
				}),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player).toMatchObject({
				questLog: expect.arrayContaining([
					expect.objectContaining({
						id: "6",
						nextQuests: ["7", "8"],
					}),
				]),
			});
			const saved =
				after.document.SaveGame.farmhands &&
				after.document.SaveGame.farmhands[0];
			expect(saved).toMatchObject({
				questLog: expect.arrayContaining([
					expect.objectContaining({ id: "6", nextQuests: ["8"] }),
				]),
			});
		}),
	));
