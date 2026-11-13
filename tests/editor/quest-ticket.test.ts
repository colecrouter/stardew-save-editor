import { malformedFixture } from "../helpers/editor-document.ts";
import { Effect } from "effect";
import { it } from "@effect/vitest";
import { expect } from "vitest";
import {
	InventoryEdits,
	setInventoryItem,
} from "../../src/lib/editor/inventory-operations.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture } from "../helpers/editor-document.ts";

const grant = Effect.gen(function* () {
	return yield* (yield* InventoryEdits).grantPrizeTicket("1");
});

it.effect(
	"awards a fixed ticket with a fresh slot identity and restores exact Undo/Redo snapshots",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			const before = yield* session.snapshot;
			yield* session.transact(
				Effect.gen(function* () {
					expect(yield* grant).toBe("added");
				}),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player.items[1]).toMatchObject({
				itemId: "PrizeTicket",
				stack: 1,
			});
			expect(after.identities["1"]?.[1]).not.toBe(before.identities["1"]?.[1]);
			expect(after.identities["1"]?.[0]).toBe(before.identities["1"]?.[0]);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			expect((yield* session.snapshot).identities).toEqual(before.identities);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
			expect((yield* session.snapshot).identities).toEqual(after.identities);
			// A queued stale empty-slot handle must not mutate the newly awarded item.
			const stale = before.identities["1"]?.[1];
			if (!stale) throw new Error("Missing test slot");
			const result = yield* Effect.result(
				session.transact(
					setInventoryItem({
						ownerId: "1",
						entityId: stale,
						property: "stack",
						value: 5,
					}),
				),
			);
			expect(result._tag).toBe("Failure");
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
);

it.effect(
	"stacks multiple rewards in order while retaining the existing item's opaque data and identity",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.items = [
				{
					$type: "StardewValley.Object" as const,
					itemId: "PrizeTicket",
					stack: 997,
					customModData: { opaque: "007" },
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
			expect(after.document.SaveGame.player.items[0]).toMatchObject({
				stack: 999,
				customModData: { opaque: "007" },
			});
			expect(after.identities).toEqual(before.identities);
			expect(after.entries).toHaveLength(1);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);

it.effect(
	"preserves opaque empty markers and publishes nothing when no reward fits",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.items = [
				malformedFixture({
					"@_xsi:nil": "true",
					customModData: { keep: "me" },
				}),
				{ $type: "StardewValley.Object", itemId: "PrizeTicket", stack: 999 },
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
);

it.effect(
	"rolls back a reward and its identity if a later transaction step fails",
	() =>
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
);

it.effect("rejects raw inventory tampering before reward authorization", () =>
	Effect.gen(function* () {
		const session = yield* makeHistorySession(tinyFixture());
		const before = yield* session.snapshot;
		const result = yield* Effect.result(
			session.transact(
				Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					snapshot.state.document.SaveGame.player.items[0] = null;
					yield* draft.replace(snapshot);
					return yield* grant;
				}),
			),
		);
		expect(result._tag).toBe("Failure");
		expect((yield* session.snapshot).document).toEqual(before.document);
	}),
);

// A matching ID alone does not make a stack compatible with a newly made ticket.
it.effect(
	"does not merge the reward into colored, special-quality or order-bound tickets",
	() =>
		Effect.gen(function* () {
			for (const extra of [
				{ $type: "StardewValley.Objects.ColoredObject" as const },
				{ quality: 1 },
				{ orderData: "QI_COOKING" },
			]) {
				const document = tinyFixture();
				const existing = {
					$type: "StardewValley.Object" as const,
					itemId: "PrizeTicket",
					stack: 1,
					...extra,
				};
				document.SaveGame.player.items = [existing, null];
				const session = yield* makeHistorySession(document);
				yield* session.transact(grant);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.items[0]).toEqual(existing);
				expect(after.document.SaveGame.player.items[1]).toMatchObject({
					itemId: "PrizeTicket",
					stack: 1,
				});
			}
		}),
);
