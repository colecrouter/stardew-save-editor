import { expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import type { Mutation } from "./domain.ts";
import { loadFixture, tinyFixture } from "./fixture.ts";
import { makeHistorySession } from "./history.ts";

const money = (value: number): Mutation => ({
	type: "money",
	farmerId: "host",
	value,
});

it.effect("undo and redo restore a compound action as one entry", () =>
	Effect.gen(function* () {
		const baseline = tinyFixture();
		const session = yield* makeHistorySession(baseline);
		const actions: Mutation[] = [
			money(99),
			{ type: "farm-name", value: "New farm" },
		];
		const after = yield* session.execute(actions, "Restore progress");
		expect(after.entries.length).toBe(1);
		expect(after.entries[0].actions).toEqual(actions);
		expect(after.entries[0].intent.label).toBe("Restore progress");
		expect((yield* session.undo).document).toEqual(baseline);
		expect((yield* session.redo).document).toEqual(after.document);
	}),
);

it.effect(
	"a failed compound action leaves document, cursor, entries and redo intact",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			yield* session.execute([money(50)]);
			yield* session.undo;
			const before = yield* session.snapshot;
			const invalid: Mutation = {
				type: "money",
				farmerId: "missing",
				value: 5,
			};
			expect(
				Exit.isFailure(
					yield* Effect.exit(
						session.execute([
							{ type: "farm-name", value: "Must not stick" },
							invalid,
						]),
					),
				),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			expect((yield* session.redo).document.SaveGame.player.money).toBe(50);
		}),
);

it.effect(
	"an outer Effect transaction rolls back multiple history updates together",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			const before = yield* session.snapshot;
			const result = yield* Effect.tx(
				Effect.gen(function* () {
					yield* session.execute([money(50)]);
					yield* session.execute([
						{ type: "money", farmerId: "missing", value: 5 },
					]);
				}),
			).pipe(Effect.exit);
			expect(Exit.isFailure(result)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}),
);

it.effect("a new edit after undo discards redo while no-ops preserve it", () =>
	Effect.gen(function* () {
		const session = yield* makeHistorySession(tinyFixture());
		yield* session.execute([money(50)]);
		yield* session.undo;
		yield* session.execute([money(10)]);
		expect((yield* session.redo).document.SaveGame.player.money).toBe(50);
		yield* session.undo;
		yield* session.execute([money(75)]);
		const branched = yield* session.snapshot;
		expect(yield* session.redo).toEqual(branched);
		expect(branched.entries.length).toBe(1);
	}),
);

it.effect("quiet reorder remains undoable and inspectable in net review", () =>
	Effect.gen(function* () {
		const baseline = tinyFixture();
		const session = yield* makeHistorySession(baseline);
		yield* session.execute([
			{ type: "reorder", farmerId: "host", order: [2, 1, 0] },
		]);
		const review = yield* session.review;
		expect(review.entries[0].intent.review).toBe("compact");
		expect(review.entries[0].forward.length).toBeGreaterThan(0);
		expect(review.net.length).toBeGreaterThan(0);
		expect((yield* session.undo).document).toEqual(baseline);
	}),
);

it.effect(
	"eviction limits undo depth without changing original-import net review",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture(), 2);
			for (const value of [20, 30, 40]) yield* session.execute([money(value)]);
			const state = yield* session.snapshot;
			expect(state.entries.length).toBe(2);
			expect(state.dropped).toBe(1);
			yield* session.undo;
			const oldest = yield* session.undo;
			expect(oldest.document.SaveGame.player.money).toBe(20);
			expect(yield* session.undo).toEqual(oldest);
			const review = yield* session.review;
			expect(review.entries).toEqual([]);
			expect(review.dropped).toBe(1);
			expect(review.net).toContainEqual({
				op: "replace",
				path: "/SaveGame/player/money",
				value: 20,
			});
		}),
);

it.effect(
	"concurrent edits retain all entries and returning to baseline has empty net review",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			yield* Effect.all(
				[20, 30, 40].map((value) => session.execute([money(value)])),
				{ concurrency: "unbounded" },
			);
			expect((yield* session.snapshot).entries.length).toBe(3);
			yield* session.execute([money(10)]);
			expect((yield* session.review).net).toEqual([]);
			expect((yield* session.snapshot).entries.length).toBe(4);
		}),
);

it.effect("full parsed save can be undone and redone without lost fields", () =>
	Effect.gen(function* () {
		const baseline = yield* Effect.promise(loadFixture);
		const session = yield* makeHistorySession(baseline);
		const action: Mutation = {
			type: "money",
			farmerId: String(baseline.SaveGame.player.UniqueMultiplayerID),
			value: 999,
		};
		const edited = yield* session.execute([action]);
		expect((yield* session.undo).document).toEqual(baseline);
		expect((yield* session.redo).document).toEqual(edited.document);
	}),
);

it.effect(
	"read models are isolated, limits/data are validated, and closed sessions reject edits",
	() =>
		Effect.gen(function* () {
			expect(
				Exit.isFailure(
					yield* Effect.exit(makeHistorySession(tinyFixture(), 0)),
				),
			).toBe(true);
			const invalid = tinyFixture();
			Object.assign(invalid.SaveGame, { unsupported: 1n });
			expect(
				Exit.isFailure(yield* Effect.exit(makeHistorySession(invalid))),
			).toBe(true);
			const escaped = yield* Effect.scoped(
				Effect.gen(function* () {
					const session = yield* makeHistorySession(tinyFixture());
					yield* session.execute([money(20)]);
					const snapshot = yield* session.snapshot;
					snapshot.document.SaveGame.player.money = 999;
					const review = yield* session.review;
					(review.net as unknown[]).length = 0;
					expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
						20,
					);
					expect((yield* session.review).net.length).toBeGreaterThan(0);
					return session;
				}),
			);
			expect(
				Exit.isFailure(yield* Effect.exit(escaped.execute([money(30)]))),
			).toBe(true);
		}),
);
