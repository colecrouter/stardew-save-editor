import { Effect, type Scope } from "effect";
import { describe, expect, it } from "vitest";
import { tinyFixture, parser, exportDocument } from "./fixtures.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	readQiOrders,
	setQiOrder,
} from "../../src/lib/editor/qi-order-operations.ts";
import templates from "../../generated/qiquests.json";
const run = <E>(effect: Effect.Effect<void, E, Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(effect));
function fixture(board: unknown = "", active: unknown = "") {
	const document = tinyFixture();
	Object.assign(document.SaveGame, {
		year: 2,
		currentSeason: "summer",
		dayOfMonth: 12,
		availableSpecialOrders: board,
		specialOrders: active,
		minesDifficulty: 2,
		skullCavesDifficulty: 1,
		mine_lowestLevelReachedForOrder: 55,
	});
	return document;
}
const offered = (key: string) => ({
	questKey: key,
	orderType: "Qi",
	questState: "InProgress",
	opaque: "007",
});
const inProgress = (key: string, rule: string, applied = true) => ({
	...offered(key),
	specialRule: rule,
	appliedSpecialRules: applied,
	dueDate: 155,
	participantsIDs: { long: [44] },
	objectives: [{ currentCount: 3, opaque: "keep" }],
});
describe("Qi order transactions", () => {
	it("does not normalize empty/singleton containers while viewing", () => {
		for (const board of [
			"",
			{},
			{ meta: "keep", SpecialOrder: offered("QiChallenge3") },
		]) {
			const document = fixture(board);
			const before = structuredClone(document);
			readQiOrders(document);
			expect(document).toEqual(before);
		}
	});
	it("offers two challenges, rejects a third, and restores exact board containers with Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture({ meta: "keep" }, "");
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setQiOrder({ kind: "offer", key: "QiChallenge3", value: true }),
				);
				yield* session.transact(
					setQiOrder({ kind: "offer", key: "QiChallenge4", value: true }),
				);
				const before = yield* session.snapshot;
				const rejected = yield* Effect.result(
					session.transact(
						setQiOrder({ kind: "offer", key: "QiChallenge5", value: true }),
					),
				);
				expect(rejected._tag).toBe("Failure");
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
				yield* session.redo;
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(before.document);
			}),
		));
	it("accepts atomically with legacy board eviction, preserving unrelated orders and exact Undo", () =>
		run(
			Effect.gen(function* () {
				const board = {
					meta: "keep",
					SpecialOrder: [
						offered("QiChallenge3"),
						offered("QiChallenge4"),
						{ questKey: "TownOrder", orderType: "" },
					],
				};
				const document = fixture(board, { opaque: "keep" });
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setQiOrder({ kind: "accept", key: "QiChallenge5" }),
				);
				const after = yield* session.snapshot;
				expect(
					readQiOrders(after.document).rows.find(
						(row) => row.key === "QiChallenge5",
					)?.state,
				).toBe("InProgress");
				expect(after.document.SaveGame).toMatchObject({
					availableSpecialOrders: {
						meta: "keep",
						SpecialOrder: [
							offered("QiChallenge4"),
							{ questKey: "TownOrder", orderType: "" },
						],
					},
					specialOrders: {
						opaque: "keep",
						SpecialOrder: {
							questKey: "QiChallenge5",
							appliedSpecialRules: false,
							seenParticipantsIDs: "",
							unclaimedRewardsIDs: "",
						},
					},
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
	it("uses game-aligned weekly/monthly deadlines and serializes every supported template", () =>
		run(
			Effect.gen(function* () {
				for (const template of templates) {
					const document = fixture();
					const session = yield* makeHistorySession(document);
					yield* session.transact(
						setQiOrder({ kind: "accept", key: template.questKey }),
					);
					const after = yield* session.snapshot;
					// Summer 12 year2 is total day151. Current week starts147, season140.
					const due =
						template.duration === "Month"
							? 168
							: template.duration === "Week"
								? 154
								: template.duration === "TwoWeeks"
									? 161
									: 151 + template.durationDays;
					expect(
						readQiOrders(after.document).rows.find(
							(row) => row.key === template.questKey,
						)?.dueDate,
					).toBe(due);
					const parsed = parser.parse(exportDocument(after.document));
					expect(
						readQiOrders(parsed).rows.find(
							(row) => row.key === template.questKey,
						)?.state,
					).toBe("InProgress");
				}
			}),
		));
	it("cancels difficulty contributions once and retains other rule/shrine sources with exact Undo", () =>
		run(
			Effect.gen(function* () {
				const current = inProgress("QiChallenge9", "MINE_HARD");
				const town = inProgress("TownOrder", "OTHER");
				const document = fixture("", {
					meta: "keep",
					SpecialOrder: [current, town],
				});
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setQiOrder({ kind: "cancel", key: "QiChallenge9" }),
				);
				expect((yield* session.snapshot).document.SaveGame).toMatchObject({
					minesDifficulty: 1,
					mine_lowestLevelReachedForOrder: -1,
					specialOrders: { meta: "keep", SpecialOrder: [town] },
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
				const shared = fixture("", {
					SpecialOrder: [current, inProgress("OtherModdedQi", "MINE_HARD")],
				});
				const second = yield* makeHistorySession(shared);
				yield* second.transact(
					setQiOrder({ kind: "cancel", key: "QiChallenge9" }),
				);
				expect((yield* second.snapshot).document.SaveGame).toMatchObject({
					minesDifficulty: 2,
					mine_lowestLevelReachedForOrder: 55,
				});
			}),
		));
	it("retains terminal, duplicate, unknown, nil and malformed targets unchanged", () =>
		run(
			Effect.gen(function* () {
				for (const document of [
					fixture("", {
						SpecialOrder: {
							...inProgress("QiChallenge3", ""),
							questState: "Complete",
						},
					}),
					fixture("", {
						SpecialOrder: [
							inProgress("QiChallenge3", ""),
							inProgress("QiChallenge3", ""),
						],
					}),
					fixture("", { SpecialOrder: inProgress("UnknownMod", "") }),
					fixture({ "@_xsi:nil": "true" }, ""),
					fixture("", {
						SpecialOrder: {
							...inProgress("QiChallenge3", "MINE_HARD"),
							appliedSpecialRules: "true",
						},
					}),
				]) {
					const session = yield* makeHistorySession(document);
					const key =
						readQiOrders(document).rows.find((row) => row.state)?.key ??
						"QiChallenge3";
					const result = yield* Effect.result(
						session.transact(setQiOrder({ kind: "cancel", key })),
					);
					expect(result._tag).toBe("Failure");
					expect((yield* session.snapshot).document).toEqual(document);
				}
			}),
		));
	it("does not evict duplicate or non-Qi records through a matching known key", () =>
		run(
			Effect.gen(function* () {
				for (const entries of [
					[offered("QiChallenge3"), offered("QiChallenge3")],
					[
						{ ...offered("QiChallenge3"), orderType: "Town" },
						offered("QiChallenge3"),
					],
				]) {
					const document = fixture({ SpecialOrder: entries }, "");
					const session = yield* makeHistorySession(document);
					const result = yield* Effect.result(
						session.transact(
							setQiOrder({ kind: "accept", key: "QiChallenge4" }),
						),
					);
					expect(result._tag).toBe("Failure");
					expect((yield* session.snapshot).document).toEqual(document);
				}
			}),
		));
	it("rejects malformed requests and invalid dates without creating entries", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				Object.assign(document.SaveGame, { year: 0 });
				const session = yield* makeHistorySession(document);
				for (const request of [
					{ kind: "offer" as const, key: "QiChallenge3", value: true },
					{ kind: "accept" as const, key: "UnknownMod" },
					{ kind: "cancel" as const, key: "QiChallenge3", extra: "bad" },
				]) {
					const result = yield* Effect.result(
						session.transact(setQiOrder(request)),
					);
					expect(result._tag).toBe("Failure");
				}
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
});
