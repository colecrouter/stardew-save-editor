import { Deferred, Effect, Exit } from "effect";
import { expect, test } from "vitest";

import { diff, farmers, MutationError } from "../../src/lib/editor/domain.ts";
import { makeEffectSession } from "./effect.ts";
import {
	exportDocument,
	loadFixture,
	parser,
	scenarios,
	tinyFixture,
} from "./fixture.ts";
import { PlainSession } from "./plain.ts";

test("both executors produce identical state and receipts on a full real save", async () => {
	const original = await loadFixture();
	const before = structuredClone(original);
	const plain = new PlainSession(original);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(original);
				for (const action of scenarios(original)) {
					const expected = plain.execute(action);
					expect(yield* session.execute(action)).toStrictEqual(expected);
				}
				const state = yield* session.snapshot;
				expect(state.history.length).toBe(3);
				expect(state.history[2]?.review).toBe("compact");
				expect(state.history[2]?.changes.length).toBeGreaterThan(0);
				expect(
					farmers(state.document).every(
						(f) => f.farmName === "Experiment Farm",
					),
				).toBe(true);
				expect(parser.parse(exportDocument(state.document))).toStrictEqual(
					state.document,
				);
				expect(original).toStrictEqual(before);
			}),
		),
	);
});

test("compound failure after writes publishes neither partial state nor history", async () => {
	const document = tinyFixture();
	const plain = new PlainSession(document);
	const action = { type: "farm-name", value: "New" } as const;
	const fail = () => {
		throw new Error("Injected after all writes");
	};
	expect(() => plain.execute(action, fail)).toThrow(
		"Injected after all writes",
	);
	expect(plain.snapshot()).toStrictEqual({ document, history: [] });
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				expect(
					Exit.isFailure(yield* Effect.exit(session.execute(action, fail))),
				).toBe(true);
				expect(yield* session.snapshot).toStrictEqual(plain.snapshot());
			}),
		),
	);
});

test("compound success updates all farmers once and duplicate IDs are rejected", async () => {
	const document = tinyFixture();
	const plain = new PlainSession(document);
	const action = { type: "farm-name", value: "Together" } as const;
	const expected = plain.execute(action);
	expect(
		farmers(expected.document).map((farmer) => farmer.farmName),
	).toStrictEqual(["Together", "Together"]);
	expect(expected.history.length).toBe(1);
	expect(expected.history[0]?.changes.length).toBe(2);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				expect(yield* session.execute(action)).toStrictEqual(expected);
			}),
		),
	);
	const duplicate = tinyFixture();
	// The tiny fixture must include a guest before testing duplicate farmer IDs.
	const guest = farmers(duplicate)[1];
	expect.assert(guest);
	guest.UniqueMultiplayerID = 1n;
	const invalid = { type: "money", farmerId: "1", value: 100 } as const;
	expect(() => new PlainSession(duplicate).execute(invalid)).toThrow(
		MutationError,
	);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(duplicate);
				expect(
					Exit.isFailure(yield* Effect.exit(session.execute(invalid))),
				).toBe(true);
				expect(yield* session.snapshot).toStrictEqual({
					document: duplicate,
					history: [],
				});
			}),
		),
	);
});

test("invalid IDs, money, and permutations fail without changes in both implementations", async () => {
	const document = tinyFixture();
	const actions = [
		{ type: "money", farmerId: "missing", value: 100 } as const,
		{ type: "money", farmerId: "1", value: Number.NaN } as const,
		{ type: "reorder", ownerId: "1", order: [0, 0, 2] } as const,
	];
	const plain = new PlainSession(document);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				for (const action of actions) {
					expect(() => plain.execute(action)).toThrow(MutationError);
					expect(
						Exit.isFailure(yield* Effect.exit(session.execute(action))),
					).toBe(true);
				}
				expect(yield* session.snapshot).toStrictEqual({
					document,
					history: [],
				});
			}),
		),
	);
});

test("reorder preserves opaque, empty, and hidden entries; no-op creates no history", async () => {
	const document = tinyFixture();
	const plain = new PlainSession(document);
	plain.execute({ type: "money", farmerId: "1", value: 10 });
	expect(plain.snapshot().history.length).toBe(0);
	const result = plain.execute({
		type: "reorder",
		ownerId: "1",
		order: [2, 1, 0],
	});
	expect(result.document.SaveGame.player.items).toStrictEqual(
		[...document.SaveGame.player.items].reverse(),
	);
	result.document.SaveGame.player.money = 999;
	expect(plain.snapshot().document.SaveGame.player.money).toBe(10);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				const view = yield* session.snapshot;
				view.document.SaveGame.player.money = 999;
				expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
					10,
				);
			}),
		),
	);
});

test("concurrent submissions serialize and closing a scope rejects future edits", async () => {
	const document = tinyFixture();
	const escaped = await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				yield* Effect.all(
					Array.from({ length: 20 }, (_, i) =>
						session.execute({
							type: "money",
							farmerId: "1",
							value: 100 + i,
						}),
					),
					{ concurrency: "unbounded" },
				);
				expect((yield* session.snapshot).history.length).toBe(20);
				return session;
			}),
		),
	);
	expect(
		Exit.isFailure(
			await Effect.runPromiseExit(
				escaped.execute({ type: "money", farmerId: "1", value: 5 }),
			),
		),
	).toBe(true);
	const plain = new PlainSession(document);
	plain.close();
	expect(() =>
		plain.execute({ type: "money", farmerId: "1", value: 5 }),
	).toThrow(MutationError);
});

test("changes outside the targeted farmer are absent, including farmhand money", () => {
	const document = tinyFixture();
	const plain = new PlainSession(document);
	const state = plain.execute({ type: "money", farmerId: "2", value: 40 });
	expect(state.document.SaveGame.player.money).toBe(10);
	expect(diff(document, state.document).map((c) => c.path)).toStrictEqual([
		"/SaveGame/farmhands",
	]);
});

test("store contract emits synchronously, observes commits, and cleans up with session", async () => {
	let notifications = 0;
	const session = await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const candidateSession = yield* makeEffectSession(tinyFixture());
				const changed = yield* Deferred.make<void>();
				const unsubscribe = candidateSession.subscribe((value) => {
					notifications++;
					if (value.document.SaveGame.player.money === 25)
						Deferred.doneUnsafe(changed, Effect.void);
					// A view cannot mutate the authoritative state.
					value.document.SaveGame.player.name = "View only";
				});
				expect.assert(notifications >= 1);
				yield* candidateSession.execute({
					type: "money",
					farmerId: "1",
					value: 25,
				});
				yield* Deferred.await(changed);
				expect(
					(yield* candidateSession.snapshot).document.SaveGame.player.name,
				).toBe("Host");
				unsubscribe();
				// Also exercise a consumer that forgets to unsubscribe.
				candidateSession.subscribe(() => {
					notifications++;
				});
				return candidateSession;
			}),
		),
	);
	expect(() => session.subscribe(() => {})).toThrow(MutationError);
	const before = notifications;
	// Scope closure has joined its consumer fibers. Attempt another publication
	// through the closed session and verify that no subscriber can observe it.
	await expect(
		Effect.runPromise(
			session.execute({ type: "money", farmerId: "1", value: 26 }),
		),
	).rejects.toThrow("Session closed");
	expect(notifications).toBe(before);
});
