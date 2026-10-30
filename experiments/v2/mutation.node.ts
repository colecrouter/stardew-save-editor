import assert from "node:assert/strict";
import { test } from "node:test";
import { Deferred, Effect, Exit } from "effect";
import { diff, farmers, MutationError } from "./domain.ts";
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
					assert.deepEqual(yield* session.execute(action), expected);
				}
				const state = yield* session.snapshot;
				assert.equal(state.history.length, 3);
				assert.equal(state.history[2].review, "compact");
				assert.ok(state.history[2].changes.length > 0);
				assert.equal(
					farmers(state.document).every(
						(f) => f.farmName === "Experiment Farm",
					),
					true,
				);
				assert.deepEqual(
					parser.parse(exportDocument(state.document)),
					state.document,
				);
				assert.deepEqual(original, before);
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
	assert.throws(() => plain.execute(action, fail));
	assert.deepEqual(plain.snapshot(), { document, history: [] });
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				assert.equal(
					Exit.isFailure(yield* Effect.exit(session.execute(action, fail))),
					true,
				);
				assert.deepEqual(yield* session.snapshot, plain.snapshot());
			}),
		),
	);
});

test("compound success updates all farmers once and duplicate IDs are rejected", async () => {
	const document = tinyFixture();
	const plain = new PlainSession(document);
	const action = { type: "farm-name", value: "Together" } as const;
	const expected = plain.execute(action);
	assert.deepEqual(
		farmers(expected.document).map((farmer) => farmer.farmName),
		["Together", "Together"],
	);
	assert.equal(expected.history.length, 1);
	assert.equal(expected.history[0].changes.length, 2);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				assert.deepEqual(yield* session.execute(action), expected);
			}),
		),
	);
	const duplicate = tinyFixture();
	farmers(duplicate)[1].UniqueMultiplayerID = "host";
	const invalid = { type: "money", farmerId: "host", value: 100 } as const;
	assert.throws(
		() => new PlainSession(duplicate).execute(invalid),
		MutationError,
	);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(duplicate);
				assert.equal(
					Exit.isFailure(yield* Effect.exit(session.execute(invalid))),
					true,
				);
				assert.deepEqual(yield* session.snapshot, {
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
		{ type: "money", farmerId: "host", value: Number.NaN } as const,
		{ type: "reorder", ownerId: "host", order: [0, 0, 2] } as const,
	];
	const plain = new PlainSession(document);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				for (const action of actions) {
					assert.throws(() => plain.execute(action), MutationError);
					assert.equal(
						Exit.isFailure(yield* Effect.exit(session.execute(action))),
						true,
					);
				}
				assert.deepEqual(yield* session.snapshot, { document, history: [] });
			}),
		),
	);
});

test("reorder preserves opaque, empty, and hidden entries; no-op creates no history", async () => {
	const document = tinyFixture();
	const plain = new PlainSession(document);
	plain.execute({ type: "money", farmerId: "host", value: 10 });
	assert.equal(plain.snapshot().history.length, 0);
	const result = plain.execute({
		type: "reorder",
		ownerId: "host",
		order: [2, 1, 0],
	});
	assert.deepEqual(
		result.document.SaveGame.player.items.Item,
		[...document.SaveGame.player.items.Item].reverse(),
	);
	result.document.SaveGame.player.money = 999;
	assert.equal(plain.snapshot().document.SaveGame.player.money, 10);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(document);
				const view = yield* session.snapshot;
				view.document.SaveGame.player.money = 999;
				assert.equal(
					(yield* session.snapshot).document.SaveGame.player.money,
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
							farmerId: "host",
							value: 100 + i,
						}),
					),
					{ concurrency: "unbounded" },
				);
				assert.equal((yield* session.snapshot).history.length, 20);
				return session;
			}),
		),
	);
	assert.equal(
		Exit.isFailure(
			await Effect.runPromiseExit(
				escaped.execute({ type: "money", farmerId: "host", value: 5 }),
			),
		),
		true,
	);
	const plain = new PlainSession(document);
	plain.close();
	assert.throws(
		() => plain.execute({ type: "money", farmerId: "host", value: 5 }),
		MutationError,
	);
});

test("changes outside the targeted farmer are absent, including farmhand money", () => {
	const document = tinyFixture();
	const plain = new PlainSession(document);
	const state = plain.execute({ type: "money", farmerId: "guest", value: 40 });
	assert.equal(state.document.SaveGame.player.money, 10);
	assert.deepEqual(
		diff(document, state.document).map((c) => c.path),
		["/SaveGame/farmhands/Farmer"],
	);
});

test("store contract emits synchronously, observes commits, and cleans up with session", async () => {
	let notifications = 0;
	const session = await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeEffectSession(tinyFixture());
				const changed = yield* Deferred.make<void>();
				const unsubscribe = session.subscribe((value) => {
					notifications++;
					if (value.document.SaveGame.player.money === 25)
						Deferred.doneUnsafe(changed, Effect.void);
					// A view cannot mutate the authoritative state.
					value.document.SaveGame.player.name = "View only";
				});
				assert.ok(notifications >= 1);
				yield* session.execute({ type: "money", farmerId: "host", value: 25 });
				yield* Deferred.await(changed);
				assert.equal(
					(yield* session.snapshot).document.SaveGame.player.name,
					"Host",
				);
				unsubscribe();
				// Also exercise a consumer that forgets to unsubscribe.
				session.subscribe(() => {
					notifications++;
				});
				return session;
			}),
		),
	);
	assert.throws(() => session.subscribe(() => {}), MutationError);
	const before = notifications;
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.equal(notifications, before);
});
