import { expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	InventoryEdits,
	setInventoryItem,
} from "../../src/lib/editor/inventory-operations";
import { setStorageQuality } from "../../src/lib/editor/storage-operations";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { tinyFixture } from "./fixtures";
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const item = () => ({
	"@_xsi:type": "Object",
	itemId: "24",
	name: "Parsnip",
	category: -75,
	bigCraftable: false,
	stack: 3,
	quality: 0,
	modData: { opaque: "007" },
});
function fixture(count = 2) {
	const document = tinyFixture();
	document.SaveGame.player.items.Item = Array.from({ length: count }, item);
	return document;
}
function selected(state: { identities: Record<string, string[]> }) {
	return (state.identities.host ?? []).map((entityId) => ({
		ownerId: "host",
		entityId,
	}));
}

it("validates every batch target before mutation even when a caller catches a later capability failure", () =>
	run(
		Effect.gen(function* () {
			const document = fixture(),
				other = document.SaveGame.player.items.Item[1];
			if (!other || typeof other !== "object")
				throw new Error("Missing fixture item");
			Object.assign(other, { "@_xsi:type": "Tool" });
			const session = yield* makeHistorySession(document),
				before = yield* session.snapshot;
			const after = yield* session.transact(
				Effect.gen(function* () {
					const result = yield* Effect.result(
						setStorageQuality(selected(before), 4),
					);
					expect(Result.isFailure(result)).toBe(true);
					const draft = yield* TransactionDraft;
					yield* draft.mutate((state) => {
						state.document.SaveGame.player.money = 99;
					});
				}),
			);
			expect(after.document.SaveGame.player.items.Item).toEqual(
				before.document.SaveGame.player.items.Item,
			);
			expect(after.document.SaveGame.player.money).toBe(99);
		}),
	));
it("rejects duplicate selections at the capability boundary and keeps no-op redo intact", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture()),
				initial = yield* session.snapshot,
				handle = selected(initial)[0];
			if (!handle) throw new Error("Missing fixture handle");
			yield* session.transact(setStorageQuality(selected(initial), 4));
			yield* session.undo;
			const before = yield* session.snapshot;
			yield* session.transact(
				Effect.gen(function* () {
					const edits = yield* InventoryEdits;
					expect(
						Result.isFailure(
							yield* Effect.result(
								edits.setQualityBatch({ items: [handle, handle], quality: 4 }),
							),
						),
					).toBe(true);
				}),
			);
			yield* session.transact(setStorageQuality(selected(before), 0));
			expect(yield* session.snapshot).toEqual(before);
			yield* session.redo;
			expect(
				(yield* session.snapshot).document.SaveGame.player.items.Item[0],
			).toMatchObject({ quality: 4 });
		}),
	));
it.each(["batch-first", "single-first"] as const)(
	"replays batch and individual quality approvals in operation order: %s",
	(order) =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture()),
					before = yield* session.snapshot,
					handles = selected(before),
					first = handles[0];
				if (!first) throw new Error("Missing fixture handle");
				yield* session.transact(
					Effect.gen(function* () {
						if (order === "batch-first") yield* setStorageQuality(handles, 4);
						yield* setInventoryItem({
							...first,
							property: "quality",
							value: 1,
						});
						if (order === "single-first") yield* setStorageQuality(handles, 4);
					}),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
					quality: order === "batch-first" ? 1 : 4,
				});
				expect(after.document.SaveGame.player.items.Item[1]).toMatchObject({
					quality: 4,
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		),
);
it("retains alias-driven property behavior across owners and unrelated saved branches", () =>
	run(
		Effect.gen(function* () {
			const document = fixture(1),
				raw = document.SaveGame.player.items.Item[0],
				hands = document.SaveGame.farmhands;
			if (hands === "" || !hands.Farmer[0])
				throw new Error("Missing fixture farmer");
			hands.Farmer[0].items.Item = [raw];
			Object.assign(document.SaveGame, { opaqueAlias: raw });
			const session = yield* makeHistorySession(document),
				before = yield* session.snapshot;
			const guest = before.identities.guest?.[0];
			if (!guest) throw new Error("Missing guest handle");
			yield* session.transact(
				setStorageQuality(
					[...selected(before), { ownerId: "guest", entityId: guest }],
					4,
				),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
				quality: 4,
				modData: { opaque: "007" },
			});
			expect(after.document.SaveGame).toMatchObject({
				opaqueAlias: { quality: 4 },
			});
			expect(after.identities).toEqual(before.identities);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));
it(
	"updates 1,000 captured items as one transaction with preserved records, handles and Undo",
	{ timeout: 10000 },
	() =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture(1000)),
					before = yield* session.snapshot;
				yield* session.transact(setStorageQuality(selected(before), 4));
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.items.Item).toHaveLength(1000);
				expect(
					after.document.SaveGame.player.items.Item.every(
						(raw) =>
							raw !== null &&
							typeof raw === "object" &&
							"quality" in raw &&
							raw.quality === 4,
					),
				).toBe(true);
				expect(after.document.SaveGame.player.items.Item[999]).toMatchObject({
					stack: 3,
					modData: { opaque: "007" },
				});
				expect(after.identities).toEqual(before.identities);
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		),
);
