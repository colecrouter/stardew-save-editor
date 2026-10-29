import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	QuestInvalid,
	setQuest,
} from "../../src/lib/editor/quest-operations.ts";
import { tinyFixture } from "./fixtures.ts";

// Recursive completion can reject after updating counters, flags and a generated
// follow-up. This remains an expected domain failure, and none of that staging
// may replace the document or consume the redo branch.
it("keeps late recursive validation failures in Effect and preserves the whole history", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const document = tinyFixture();
				Object.assign(document.SaveGame, {
					constructedBuildings: { string: ["Coop"] },
				});
				Object.assign(document.SaveGame.player, {
					questLog: {
						Quest: [
							{
								id: "parent",
								_questTitle: "Parent quest",
								questType: 1,
								completed: false,
								dailyQuest: true,
								destroy: false,
								canBeCancelled: true,
								moneyReward: 100,
								daysLeft: 1,
								nextQuests: { int: [7] },
							},
						],
					},
					stats: {
						Values: {
							item: [
								{
									key: { string: "BillboardQuestsDone" },
									value: { unsignedInt: 2 },
								},
							],
						},
					},
					mailReceived: "",
					activeDialogueEvents: {
						item: [{ key: { string: 5 }, value: { int: 4 } }],
					},
					previousActiveDialogueEvents: "",
				});
				const session = yield* makeHistorySession(document);
				const target = { farmerId: "host", questKey: "id:parent" };
				yield* session.transact(
					setQuest({ ...target, kind: "reward", value: 200 }),
				);
				yield* session.undo;
				const before = yield* session.snapshot;
				expect(before.cursor).toBe(0);
				expect(before.entries).toHaveLength(1);
				const result = yield* Effect.result(
					session.transact(setQuest({ ...target, kind: "complete" })),
				);
				expect(Result.isFailure(result)).toBe(true);
				if (Result.isFailure(result)) {
					expect(result.failure).toBeInstanceOf(QuestInvalid);
					expect(result.failure.message).toBe(
						"This farmer's dialogue topic keys are unsupported.",
					);
				}
				const after = yield* session.snapshot;
				expect(after).toEqual(before);
			}),
		),
	));
