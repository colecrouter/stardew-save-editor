import { Effect } from "effect";
import { expect, it } from "vitest";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	projectReview,
	isReviewPathCovered,
} from "../../src/lib/editor/review-projection.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { parser, fixtureXml } from "./fixtures.ts";
const fixture = () => parser.parse(fixtureXml);

it("compares the final gold value with import rather than replaying intermediate edits", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const document = fixture();
				const original = document.SaveGame.player.money;
				const session = yield* makeHistorySession(document, { entries: 1 });
				const farmerId = String(document.SaveGame.player.UniqueMultiplayerID);
				yield* session.execute([{ type: "money", farmerId, value: 25000 }]);
				yield* session.execute([{ type: "money", farmerId, value: 30000 }]);
				const state = yield* session.snapshot;
				const review = projectReview(state);
				expect(state.dropped).toBeGreaterThan(0);
				expect(
					review.groups.find((group) => group.feature === "character")?.changes,
				).toContainEqual({
					_tag: "FieldChanged",
					subject: document.SaveGame.player.name,
					label: "Gold",
					before: original,
					after: 30000,
				});
				expect(review.otherChanges).toEqual([]);
				// Returning to the imported value has no export summary even while history
				// still contains a deliberate edit and older actions have been evicted.
				yield* session.execute([{ type: "money", farmerId, value: original }]);
				expect(projectReview(yield* session.snapshot)).toMatchObject({
					groups: [],
					otherChanges: [],
				});
			}),
		),
	));

it("keeps unknown export writes visible and detached from the engine", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const document = fixture();
				Object.assign(document.SaveGame, {
					customModData: { "name/with~escapes": "before" },
				});
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						yield* draft.mutate((state) => {
							Object.assign(state.document.SaveGame, {
								customModData: { "name/with~escapes": "after" },
							});
						});
					}),
				);
				const state = yield* session.snapshot;
				const review = projectReview(state);
				expect(review.groups).toEqual([]);
				expect(review.otherChanges).toEqual([
					{
						op: "replace",
						path: "/SaveGame/customModData/name~1with~0escapes",
						value: "after",
					},
				]);
				const patch = review.otherChanges[0];
				if (!patch) throw new Error("Missing unknown patch");
				Object.assign(patch, { value: "public mutation" });
				expect(projectReview(state).otherChanges).toEqual([
					{
						op: "replace",
						path: "/SaveGame/customModData/name~1with~0escapes",
						value: "after",
					},
				]);
			}),
		),
	));

it("shows additions as domain entities and retains opaque side effects in technical fallback", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const document = fixture();
				Object.assign(document.SaveGame.player, { questLog: [] });
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						yield* draft.mutate((state) => {
							Object.assign(state.document.SaveGame.player, {
								questLog: [
									{
										id: "custom-review",
										_questTitle: "A new request",
										_questDescription: "Please help",
										_currentObjective: "Bring Wood",
										completed: false,
										dailyQuest: false,
										destroy: false,
										canBeCancelled: true,
										moneyReward: 100,
										daysLeft: 0,
										questType: 1,
										nextQuests: [],
										customModData: { opaque: "keep" },
									},
								],
							});
						});
					}),
				);
				const review = projectReview(yield* session.snapshot);
				expect(
					review.groups.find((group) => group.feature === "quests")?.changes,
				).toContainEqual({
					_tag: "EntityAdded",
					subject: document.SaveGame.player.name,
					label: "A new request",
					value: "Active",
				});
				expect(review.otherChanges.length).toBeGreaterThan(0);
			}),
		),
	));

it("never claims coalesced parents, escaped siblings or prefix-like array indices", () => {
	expect(
		isReviewPathCovered("/SaveGame/player", ["/SaveGame/player/money"]),
	).toBe(false);
	expect(
		isReviewPathCovered("/SaveGame/player/money", ["/SaveGame/player/money"]),
	).toBe(true);
	expect(
		isReviewPathCovered("/SaveGame/name~1inside/value", [
			"/SaveGame/name/inside",
		]),
	).toBe(false);
	expect(
		isReviewPathCovered("/SaveGame/name~1inside/value", [
			"/SaveGame/name~1inside",
		]),
	).toBe(true);
	expect(
		isReviewPathCovered("/SaveGame/items/10/name", ["/SaveGame/items/1"]),
	).toBe(false);
	expect(isReviewPathCovered("", ["/SaveGame/player"])).toBe(false);
});

it("does not let another recognised field hide an unsupported imported value", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const document = fixture();
				Object.assign(document.SaveGame.player, {
					difficultyModifier: "unsupported before",
				});
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						yield* draft.mutate((state) => {
							Object.assign(state.document.SaveGame.player, {
								farmName: "Changed farm",
								difficultyModifier: "unsupported after",
							});
						});
					}),
				);
				const review = projectReview(yield* session.snapshot);
				expect(
					review.groups.find((group) => group.feature === "farm")?.changes,
				).toContainEqual({
					_tag: "FieldChanged",
					subject: "Farm",
					label: "Farm name",
					before: document.SaveGame.player.farmName,
					after: "Changed farm",
				});
				expect(review.otherChanges).toContainEqual({
					op: "replace",
					path: "/SaveGame/player/difficultyModifier",
					value: "unsupported after",
				});
			}),
		),
	));

it("reviews a supported guest beside an unclaimed farmer placeholder", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const document = fixture();
				const guest = structuredClone(document.SaveGame.player);
				guest.UniqueMultiplayerID = 2n;
				guest.name = "Guest";
				guest.money = 100;
				document.SaveGame.farmhands = [{ name: "", items: [] }, guest];
				const session = yield* makeHistorySession(document);
				yield* session.execute([{ type: "money", farmerId: "2", value: 200 }]);
				const review = projectReview(yield* session.snapshot);
				expect(
					review.groups.find((group) => group.feature === "character")?.changes,
				).toContainEqual({
					_tag: "FieldChanged",
					subject: "Guest",
					label: "Gold",
					before: 100,
					after: 200,
				});
			}),
		),
	));
