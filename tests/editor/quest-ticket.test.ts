import { Effect, Scope } from "effect";
import { expect, it } from "vitest";
import {
	BackpackItemEdits,
	setBackpackItem,
} from "../../src/lib/editor/inventory-operations.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture } from "./fixtures.ts";
const run = <E>(program: Effect.Effect<void, E, Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(program));
const grant = Effect.gen(function* () {
	return yield* (yield* BackpackItemEdits).grantPrizeTicket("host");
});

it("awards a fixed ticket with a fresh slot identity and restores exact Undo/Redo snapshots", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			const before = yield* session.snapshot;
			yield* session.transact(
				Effect.gen(function* () {
					expect(yield* grant).toBe("added");
				}),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player.items.Item[1]).toMatchObject({
				itemId: "PrizeTicket",
				stack: 1,
			});
			expect(after.identities.host?.[1]).not.toBe(before.identities.host?.[1]);
			expect(after.identities.host?.[0]).toBe(before.identities.host?.[0]);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			expect((yield* session.snapshot).identities).toEqual(before.identities);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
			expect((yield* session.snapshot).identities).toEqual(after.identities);
			// A queued stale empty-slot handle must not mutate the newly awarded item.
			const stale = before.identities.host?.[1];
			if (!stale) throw new Error("Missing test slot");
			const result = yield* Effect.result(
				session.transact(
					setBackpackItem({
						farmerId: "host",
						entityId: stale,
						property: "stack",
						value: 5,
					}),
				),
			);
			expect(result._tag).toBe("Failure");
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
	));

it("stacks multiple rewards in order while retaining the existing item's opaque data and identity", () =>
	run(
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.items.Item = [
				{
					"@_xsi:type": "Object",
					itemId: "PrizeTicket",
					stack: 997,
					modData: { opaque: "007" },
				},
			];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.transact(
				Effect.gen(function* () {
					yield* grant;
					yield* grant;
				}),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
				stack: 999,
				modData: { opaque: "007" },
			});
			expect(after.identities).toEqual(before.identities);
			expect(after.entries).toHaveLength(1);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

it("preserves opaque empty markers and publishes nothing when no reward fits", () =>
	run(
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.items.Item = [
				{ "@_xsi:nil": "true", modData: { keep: "me" } },
				{ itemId: "PrizeTicket", stack: 999 },
			];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.transact(
				Effect.gen(function* () {
					expect(yield* grant).toBe("noRoom");
				}),
			);
			expect((yield* session.snapshot).document).toEqual(before.document);
			expect((yield* session.snapshot).entries).toHaveLength(0);
		}),
	));

it("rolls back a reward and its identity if a later transaction step fails", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			const before = yield* session.snapshot;
			const result = yield* Effect.result(
				session.transact(
					Effect.gen(function* () {
						yield* grant;
						return yield* Effect.fail("stop");
					}),
				),
			);
			expect(result._tag).toBe("Failure");
			expect((yield* session.snapshot).document).toEqual(before.document);
			expect((yield* session.snapshot).identities).toEqual(before.identities);
			expect((yield* session.snapshot).entries).toHaveLength(0);
		}),
	));

it("rejects raw inventory tampering before reward authorization", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			const before = yield* session.snapshot;
			const result = yield* Effect.result(
				session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						snapshot.state.document.SaveGame.player.items.Item[0] = {
							"@_xsi:nil": "true",
						};
						yield* draft.replace(snapshot);
						return yield* grant;
					}),
				),
			);
			expect(result._tag).toBe("Failure");
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

// A matching ID alone does not make a stack compatible with a newly made ticket.
it("does not merge the reward into colored, special-quality or order-bound tickets", () =>
	run(
		Effect.gen(function* () {
			for (const extra of [
				{ "@_xsi:type": "ColoredObject" },
				{ quality: 1 },
				{ orderData: "QI_COOKING" },
			]) {
				const document = tinyFixture();
				const existing = {
					"@_xsi:type": "Object",
					itemId: "PrizeTicket",
					stack: 1,
					...extra,
				};
				document.SaveGame.player.items.Item = [
					existing,
					{ "@_xsi:nil": "true" },
				];
				const session = yield* makeHistorySession(document);
				yield* session.transact(grant);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.items.Item[0]).toEqual(existing);
				expect(after.document.SaveGame.player.items.Item[1]).toMatchObject({
					itemId: "PrizeTicket",
					stack: 1,
				});
			}
		}),
	));
