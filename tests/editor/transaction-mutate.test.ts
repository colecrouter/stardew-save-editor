import { Effect, Result, Exit, Cause, Deferred, Fiber } from "effect";
import { it } from "@effect/vitest";
import { expect } from "vitest";
import {
	makeTransactionDraftFromCommitted,
	makeTransactionDraft,
} from "../../src/lib/editor/transaction-draft";
import { makeHistorySession } from "../../src/lib/editor/history";
import { setFarmSettings } from "../../src/lib/editor/farm-operations";
import { MutationError } from "../../src/lib/editor/domain";
import type { SessionState } from "../../src/lib/editor/domain";
import { tinyFixture } from "../helpers/editor-document.ts";

const initial = (): SessionState => ({
	document: tinyFixture(),
	history: [],
	domainState: {},
});

it.effect(
	"detaches inserted values, protects reflected owned branches and revokes the writer",
	() =>
		Effect.gen(function* () {
			const state = initial();
			const draft = makeTransactionDraftFromCommitted(state);
			const inserted = { values: ["kept"] };
			let escaped: SessionState | undefined;
			yield* draft.service.mutate((writer) => {
				escaped = writer;
				const reflected = Object.getOwnPropertyDescriptor(
					writer,
					"document",
				)?.value;
				expect(() => {
					reflected.SaveGame.player.farmName = "poisoned";
				}).toThrow();
				writer.document.SaveGame.player.farmName = "Changed";
				Object.assign(writer.document.SaveGame, { opaque: inserted });
			});
			expect(() => escaped?.document).toThrow();
			inserted.values[0] = "caller mutation";
			const prepared = yield* draft.prepared;
			expect(prepared.document.SaveGame).toMatchObject({
				opaque: { values: ["kept"] },
			});
			expect(prepared.document.SaveGame.player.items).toBe(
				state.document.SaveGame.player.items,
			);
			expect(state.document.SaveGame.player.farmName).toBe("Farm");
			yield* draft.close;
		}),
);

it.effect(
	"preserves shared-reference behavior through the detached fallback, including newly inserted aliases",
	() =>
		Effect.gen(function* () {
			const draft = makeTransactionDraft(initial());
			const shared = { value: 1 };
			yield* draft.service.mutate((writer) => {
				Object.assign(writer.document.SaveGame, {
					left: shared,
					right: shared,
				});
			});
			yield* draft.service.mutate((writer) => {
				const game = writer.document
					.SaveGame as typeof writer.document.SaveGame & {
					left: { value: number };
					right: { value: number };
				};
				game.left.value = 2;
				expect(game.right.value).toBe(2);
			});
			expect((yield* draft.prepared).document.SaveGame).toMatchObject({
				left: { value: 2 },
				right: { value: 2 },
			});
			shared.value = 999;
			expect((yield* draft.prepared).document.SaveGame).toMatchObject({
				left: { value: 2 },
				right: { value: 2 },
			});
			yield* draft.close;
		}),
);

it.effect(
	"rejects invalid saved values and preserves signed zero, escaped keys and array edits",
	() =>
		Effect.gen(function* () {
			const draft = makeTransactionDraft(initial());
			yield* draft.service.mutate((writer) => {
				Object.assign(writer.document.SaveGame, {
					number: 0,
					list: [1, 2],
					"a/b": { "~x": 1 },
					constructor: { safe: true },
				});
			});
			yield* draft.service.mutate((writer) => {
				const game = writer.document
					.SaveGame as typeof writer.document.SaveGame & {
					number: number;
					list: number[];
					"a/b": { "~x": number };
				};
				game.number = -0;
				game.list.reverse();
				game["a/b"]["~x"] = 2;
			});
			const before = yield* draft.prepared;
			expect(
				Object.is(Reflect.get(before.document.SaveGame, "number"), -0),
			).toBe(true);
			expect(before.document.SaveGame).toMatchObject({
				list: [2, 1],
				"a/b": { "~x": 2 },
				constructor: { safe: true },
			});
			for (const invalid of ["undefined", "sparse", "class"]) {
				const result = yield* Effect.result(
					draft.service.mutate((writer) => {
						if (invalid === "undefined")
							Object.assign(writer.document.SaveGame, { invalid: undefined });
						if (invalid === "sparse")
							writer.document.SaveGame.player.items.length += 2;
						if (invalid === "class")
							Object.assign(writer.document.SaveGame, { opaque: new Date() });
					}),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect(yield* draft.prepared).toBe(before);
			}
			yield* draft.close;
		}),
);

it.effect(
	"keeps old snapshots stale after changes, leaves no-op versions intact and releases failed writers",
	() =>
		Effect.gen(function* () {
			const draft = makeTransactionDraft(initial());
			const snapshot = yield* draft.service.read;
			yield* draft.service.mutate(() => {});
			expect((yield* draft.service.read).version).toBe(snapshot.version);
			yield* draft.service.mutate((writer) => {
				writer.document.SaveGame.player.farmName = "Changed";
			});
			const stale = yield* Effect.result(draft.service.replace(snapshot));
			expect(Result.isFailure(stale)).toBe(true);
			let escaped: SessionState | undefined;
			const failure = yield* Effect.exit(
				draft.service.mutate((writer) => {
					escaped = writer;
					writer.document.SaveGame.player.farmName = "discard";
					throw Error("recipe defect");
				}),
			);
			expect(Exit.isFailure(failure) && Cause.hasDies(failure.cause)).toBe(
				true,
			);
			expect(() => escaped?.document).toThrow();
			expect((yield* draft.prepared).document.SaveGame.player.farmName).toBe(
				"Changed",
			);
			yield* draft.close;
			const closed = yield* Effect.result(draft.service.mutate(() => {}));
			expect(Result.isFailure(closed)).toBe(true);
		}),
);

it.effect(
	"revokes writers on finalization failure and rejects returned replacement values",
	() =>
		Effect.gen(function* () {
			const draft = makeTransactionDraft(initial());
			let escaped: SessionState | undefined;
			const getterFailure = yield* Effect.exit(
				draft.service.mutate((writer) => {
					escaped = writer;
					Object.assign(writer.document.SaveGame, {
						foreign: {
							get value() {
								throw Error("getter defect");
							},
						},
					});
				}),
			);
			expect(Exit.isFailure(getterFailure)).toBe(true);
			expect(() => escaped?.document).toThrow();
			const replacement = yield* Effect.exit(
				// @ts-expect-error A writer must not return a replacement or async result.
				draft.service.mutate((writer) => {
					escaped = writer;
					return writer.document;
				}),
			);
			expect(Exit.isFailure(replacement)).toBe(true);
			expect(() => escaped?.document).toThrow();
			expect((yield* draft.prepared).document.SaveGame.player.farmName).toBe(
				"Farm",
			);
			yield* draft.close;
		}),
);

it.effect(
	"rolls back valid farm mutations on failure/interruption and retries against a fresh committed state",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			const before = yield* session.snapshot;
			const failure = yield* Effect.result(
				session.transact(
					Effect.gen(function* () {
						yield* setFarmSettings({ name: "Discard" });
						return yield* new MutationError("later child failed");
					}),
				),
			);
			expect(Result.isFailure(failure)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			const staged = yield* Deferred.make<void>();
			const interrupted = yield* Effect.forkChild(
				session.transact(
					Effect.gen(function* () {
						yield* setFarmSettings({ name: "Interrupted" });
						yield* Deferred.succeed(staged, undefined);
						return yield* Effect.never;
					}),
				),
			);
			yield* Deferred.await(staged);
			yield* Fiber.interrupt(interrupted);
			expect(yield* session.snapshot).toEqual(before);
			// A real revision conflict reruns the recipe against a new private baseline;
			// the competing money edit must survive, and only the successful attempt commits.
			const entered = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			let attempts = 0;
			const retrying = yield* Effect.forkChild(
				session.transact(
					Effect.gen(function* () {
						attempts++;
						yield* setFarmSettings({ name: "Retried" });
						yield* Deferred.succeed(entered, undefined);
						yield* Deferred.await(release);
					}),
				),
			);
			yield* Deferred.await(entered);
			yield* session.execute([{ type: "money", farmerId: "1", value: 99 }]);
			yield* Deferred.succeed(release, undefined);
			yield* Fiber.join(retrying);
			const after = yield* session.snapshot;
			expect(attempts).toBeGreaterThanOrEqual(2);
			expect(after.document.SaveGame.player.farmName).toBe("Retried");
			expect(after.document.SaveGame.player.money).toBe(99);
			expect(after.entries).toHaveLength(2);
			yield* session.undo;
			expect((yield* session.snapshot).document.SaveGame.player.farmName).toBe(
				"Farm",
			);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
);

it.effect(
	"rejects returned Effects and Promises without treating them as asynchronous recipes",
	() =>
		Effect.gen(function* () {
			const draft = makeTransactionDraft(initial());
			let escaped: SessionState | undefined;
			let ran = false;
			for (const value of [
				Effect.sync(() => {
					ran = true;
				}),
				Promise.resolve(),
			]) {
				const exit = yield* Effect.exit(
					// @ts-expect-error Async/Effect work belongs outside the synchronous writer.
					draft.service.mutate((writer) => {
						escaped = writer;
						return value;
					}),
				);
				expect(Exit.isFailure(exit)).toBe(true);
				expect(() => escaped?.document).toThrow();
			}
			expect(ran).toBe(false);
			yield* draft.close;
		}),
);

it.effect(
	"checks inspection versions before invoking writers and closes owner inspection",
	() =>
		Effect.gen(function* () {
			const draft = makeTransactionDraft(initial());
			const inspected = yield* draft.inspect;
			expect(Object.isFrozen(inspected.state.document.SaveGame.player)).toBe(
				true,
			);
			const detached = yield* draft.service.read;
			detached.state.document.SaveGame.player.money = 20;
			yield* draft.service.replace(detached);
			let invoked = false;
			const stale = yield* Effect.result(
				draft.service.mutate(() => {
					invoked = true;
				}, inspected.version),
			);
			expect(Result.isFailure(stale)).toBe(true);
			expect(invoked).toBe(false);
			// A matching no-op neither changes state nor advances its version.
			const current = yield* draft.inspect;
			yield* draft.service.mutate(() => undefined, current.version);
			expect((yield* draft.inspect).version).toBe(current.version);
			yield* draft.close;
			expect(Result.isFailure(yield* Effect.result(draft.inspect))).toBe(true);
		}),
);
