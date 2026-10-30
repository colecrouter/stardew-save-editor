import { expect, it } from "vitest";
import { Deferred, Effect, Fiber, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import { setBackpackItem } from "../../src/lib/editor/inventory-operations";
import { MutationError } from "../../src/lib/editor/domain";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { tinyFixture } from "./fixtures";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
function fixture() {
	const document = tinyFixture();
	const item = {
		"@_xsi:type": "Object",
		itemId: "24",
		name: "Parsnip",
		bigCraftable: false,
		category: -75,
		stack: 3,
		quality: 0,
		modData: { opaque: "007" },
	};
	document.SaveGame.player.items.Item = [item];
	return { document, item };
}
function change(entityId: string, value = 8) {
	return setBackpackItem({
		farmerId: "host",
		entityId,
		property: "stack",
		value,
	});
}
function handle(state: { identities: Record<string, string[]> }) {
	const id = state.identities.host?.[0];
	if (!id) throw new Error("Missing fixture item identity");
	return id;
}

it.each(["before", "after"] as const)(
	"rejects raw writes to another owner %s an approved item edit",
	(order) =>
		run(
			Effect.gen(function* () {
				const { document } = fixture();
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const raw = Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					const hands = snapshot.state.document.SaveGame.farmhands;
					if (hands === "" || !hands.Farmer[0])
						throw new Error("Missing guest");
					// The authorized host edit cannot approve changes to another owner,
					// even when that owner's inventory has no editable item handles.
					hands.Farmer[0].items.Item.push({ "@_xsi:nil": "true" });
					yield* draft.replace(snapshot);
				});
				const result = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							if (order === "before") yield* raw;
							yield* change(handle(before));
							if (order === "after") yield* raw;
						}),
					),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		),
);

it("preserves alias-driven writes across owners and unrelated saved data", () =>
	run(
		Effect.gen(function* () {
			const { document, item } = fixture();
			const hands = document.SaveGame.farmhands;
			if (hands === "" || !hands.Farmer[0]) throw new Error("Missing guest");
			// Valid JSON-shaped graphs can share imported objects. Replay must follow
			// the same aliases as detached draft mutation, including outside inventory.
			hands.Farmer[0].items.Item = [item];
			Object.assign(document.SaveGame, { opaqueAlias: item });
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const after = yield* session.transact(change(handle(before)));
			const expected = structuredClone(before.document);
			Object.assign(expected.SaveGame.player.items.Item[0] as object, {
				stack: 8,
			});
			expect(after.document).toEqual(expected);
			expect(item.stack).toBe(3);
			expect((yield* session.undo).document).toEqual(before.document);
			expect((yield* session.redo).document).toEqual(after.document);
		}),
	));

it("discards failed/interrupted authorization and retries against a fresh baseline", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture().document);
			const before = yield* session.snapshot;
			const id = handle(before);
			const failed = yield* Effect.result(
				session.transact(
					Effect.gen(function* () {
						yield* change(id);
						return yield* new MutationError("Later child failed");
					}),
				),
			);
			expect(Result.isFailure(failed)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			const staged = yield* Deferred.make<void>();
			const interrupted = yield* Effect.forkChild(
				session.transact(
					Effect.gen(function* () {
						yield* change(id);
						yield* Deferred.succeed(staged, undefined);
						return yield* Effect.never;
					}),
				),
			);
			yield* Deferred.await(staged);
			yield* Fiber.interrupt(interrupted);
			expect(yield* session.snapshot).toEqual(before);
			// A competing revision must discard the old attempt's replay authority.
			// Only the successful retry may publish, preserving the competing edit.
			const entered = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			let attempts = 0;
			const retrying = yield* Effect.forkChild(
				session.transact(
					Effect.gen(function* () {
						attempts++;
						yield* change(id);
						yield* Deferred.succeed(entered, undefined);
						yield* Deferred.await(release);
					}),
				),
			);
			yield* Deferred.await(entered);
			yield* session.execute([{ type: "money", farmerId: "host", value: 99 }]);
			yield* Deferred.succeed(release, undefined);
			yield* Fiber.join(retrying);
			const after = yield* session.snapshot;
			expect(attempts).toBeGreaterThanOrEqual(2);
			expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
				stack: 8,
			});
			expect(after.document.SaveGame.player.money).toBe(99);
			expect(after.entries).toHaveLength(2);
			const undo = yield* session.undo;
			expect(undo.document.SaveGame.player.items.Item[0]).toMatchObject({
				stack: 3,
			});
			expect(undo.document.SaveGame.player.money).toBe(99);
			expect((yield* session.redo).document).toEqual(after.document);
		}),
	));
