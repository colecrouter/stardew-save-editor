import { Effect, Result, Exit, Cause, Deferred, Fiber } from "effect";
import { expect, it } from "vitest";
import {
	makeTransactionDraftFromCommitted,
	makeTransactionDraft,
} from "../../src/lib/editor/transaction-draft";
import { makeHistorySession } from "../../src/lib/editor/history";
import { setFarmSettings } from "../../src/lib/editor/farm-operations";
import { MutationError } from "../../src/lib/editor/domain";
import type { SessionState } from "../../src/lib/editor/domain";
import { tinyFixture } from "./fixtures";

const initial = (): SessionState => ({
	document: tinyFixture(),
	history: [],
	domainState: {},
});

it("detaches inserted values, protects reflected owned branches and revokes the writer", async () => {
	const state = initial();
	const draft = makeTransactionDraftFromCommitted(state);
	const inserted = { values: ["kept"] };
	let escaped: SessionState | undefined;
	await Effect.runPromise(
		draft.service.mutate((writer) => {
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
		}),
	);
	expect(() => escaped?.document).toThrow();
	inserted.values[0] = "caller mutation";
	const prepared = await Effect.runPromise(draft.prepared);
	expect(prepared.document.SaveGame).toMatchObject({
		opaque: { values: ["kept"] },
	});
	expect(prepared.document.SaveGame.player.items).toBe(
		state.document.SaveGame.player.items,
	);
	expect(state.document.SaveGame.player.farmName).toBe("Farm");
	await Effect.runPromise(draft.close);
});

it("preserves shared-reference behavior through the detached fallback, including newly inserted aliases", async () => {
	const draft = makeTransactionDraft(initial());
	const shared = { value: 1 };
	await Effect.runPromise(
		draft.service.mutate((writer) => {
			Object.assign(writer.document.SaveGame, { left: shared, right: shared });
		}),
	);
	await Effect.runPromise(
		draft.service.mutate((writer) => {
			const game = writer.document
				.SaveGame as typeof writer.document.SaveGame & {
				left: { value: number };
				right: { value: number };
			};
			game.left.value = 2;
			expect(game.right.value).toBe(2);
		}),
	);
	expect(
		(await Effect.runPromise(draft.prepared)).document.SaveGame,
	).toMatchObject({ left: { value: 2 }, right: { value: 2 } });
	shared.value = 999;
	expect(
		(await Effect.runPromise(draft.prepared)).document.SaveGame,
	).toMatchObject({ left: { value: 2 }, right: { value: 2 } });
	await Effect.runPromise(draft.close);
});

it("rejects invalid JSON and preserves signed zero, escaped keys and array edits", async () => {
	const draft = makeTransactionDraft(initial());
	await Effect.runPromise(
		draft.service.mutate((writer) => {
			Object.assign(writer.document.SaveGame, {
				number: 0,
				list: [1, 2],
				"a/b": { "~x": 1 },
				constructor: { safe: true },
			});
		}),
	);
	await Effect.runPromise(
		draft.service.mutate((writer) => {
			const game = writer.document
				.SaveGame as typeof writer.document.SaveGame & {
				number: number;
				list: number[];
				"a/b": { "~x": number };
			};
			game.number = -0;
			game.list.reverse();
			game["a/b"]["~x"] = 2;
		}),
	);
	const before = await Effect.runPromise(draft.prepared);
	expect(Object.is(Reflect.get(before.document.SaveGame, "number"), -0)).toBe(
		true,
	);
	expect(before.document.SaveGame).toMatchObject({
		list: [2, 1],
		"a/b": { "~x": 2 },
		constructor: { safe: true },
	});
	for (const invalid of ["undefined", "sparse", "class"]) {
		const result = await Effect.runPromise(
			Effect.result(
				draft.service.mutate((writer) => {
					if (invalid === "undefined")
						Object.assign(writer.document.SaveGame, { invalid: undefined });
					if (invalid === "sparse")
						writer.document.SaveGame.player.items.Item.length += 2;
					if (invalid === "class")
						Object.assign(writer.document.SaveGame, { opaque: new Date() });
				}),
			),
		);
		expect(Result.isFailure(result)).toBe(true);
		expect(await Effect.runPromise(draft.prepared)).toBe(before);
	}
	await Effect.runPromise(draft.close);
});

it("keeps old snapshots stale after changes, leaves no-op versions intact and releases failed writers", async () => {
	const draft = makeTransactionDraft(initial());
	const snapshot = await Effect.runPromise(draft.service.read);
	await Effect.runPromise(draft.service.mutate(() => {}));
	expect((await Effect.runPromise(draft.service.read)).version).toBe(
		snapshot.version,
	);
	await Effect.runPromise(
		draft.service.mutate((writer) => {
			writer.document.SaveGame.player.farmName = "Changed";
		}),
	);
	const stale = await Effect.runPromise(
		Effect.result(draft.service.replace(snapshot)),
	);
	expect(Result.isFailure(stale)).toBe(true);
	let escaped: SessionState | undefined;
	const failure = await Effect.runPromiseExit(
		draft.service.mutate((writer) => {
			escaped = writer;
			writer.document.SaveGame.player.farmName = "discard";
			throw Error("recipe defect");
		}),
	);
	expect(Exit.isFailure(failure) && Cause.hasDies(failure.cause)).toBe(true);
	expect(() => escaped?.document).toThrow();
	expect(
		(await Effect.runPromise(draft.prepared)).document.SaveGame.player.farmName,
	).toBe("Changed");
	await Effect.runPromise(draft.close);
	const closed = await Effect.runPromise(
		Effect.result(draft.service.mutate(() => {})),
	);
	expect(Result.isFailure(closed)).toBe(true);
});

it("revokes writers on finalization failure and rejects returned replacement values", async () => {
	const draft = makeTransactionDraft(initial());
	let escaped: SessionState | undefined;
	const getterFailure = await Effect.runPromiseExit(
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
	const replacement = await Effect.runPromiseExit(
		// @ts-expect-error A writer must not return a replacement or async result.
		draft.service.mutate((writer) => {
			escaped = writer;
			return writer.document;
		}),
	);
	expect(Exit.isFailure(replacement)).toBe(true);
	expect(() => escaped?.document).toThrow();
	expect(
		(await Effect.runPromise(draft.prepared)).document.SaveGame.player.farmName,
	).toBe("Farm");
	await Effect.runPromise(draft.close);
});

it("rolls back valid farm mutations on failure/interruption and retries against a fresh committed state", () =>
	Effect.runPromise(
		Effect.scoped(
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
				yield* session.execute([
					{ type: "money", farmerId: "host", value: 99 },
				]);
				yield* Deferred.succeed(release, undefined);
				yield* Fiber.join(retrying);
				const after = yield* session.snapshot;
				expect(attempts).toBeGreaterThanOrEqual(2);
				expect(after.document.SaveGame.player.farmName).toBe("Retried");
				expect(after.document.SaveGame.player.money).toBe(99);
				expect(after.entries).toHaveLength(2);
				yield* session.undo;
				expect(
					(yield* session.snapshot).document.SaveGame.player.farmName,
				).toBe("Farm");
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		),
	));

it("rejects returned Effects and Promises without treating them as asynchronous recipes", async () => {
	const draft = makeTransactionDraft(initial());
	let escaped: SessionState | undefined;
	let ran = false;
	for (const value of [
		Effect.sync(() => {
			ran = true;
		}),
		Promise.resolve(),
	]) {
		const exit = await Effect.runPromiseExit(
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
	await Effect.runPromise(draft.close);
});

it("checks inspection versions before invoking writers and closes owner inspection", async () => {
	const draft = makeTransactionDraft(initial());
	const inspected = await Effect.runPromise(draft.inspect);
	expect(Object.isFrozen(inspected.state.document.SaveGame.player)).toBe(true);
	const detached = await Effect.runPromise(draft.service.read);
	detached.state.document.SaveGame.player.money = 20;
	await Effect.runPromise(draft.service.replace(detached));
	let invoked = false;
	const stale = await Effect.runPromise(
		Effect.result(
			draft.service.mutate(() => {
				invoked = true;
			}, inspected.version),
		),
	);
	expect(Result.isFailure(stale)).toBe(true);
	expect(invoked).toBe(false);
	// A matching no-op neither changes state nor advances its version.
	const current = await Effect.runPromise(draft.inspect);
	await Effect.runPromise(
		draft.service.mutate(() => undefined, current.version),
	);
	expect((await Effect.runPromise(draft.inspect)).version).toBe(
		current.version,
	);
	await Effect.runPromise(draft.close);
	expect(
		Result.isFailure(await Effect.runPromise(Effect.result(draft.inspect))),
	).toBe(true);
});
