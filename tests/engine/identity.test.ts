import { vi } from "vitest";
import { stringifySavedData } from "../../src/lib/editor/saved-data.ts";
import { expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { inventoryFixture } from "./inventory-model.ts";

// Retain the engine suite's budget for full-save codecs and worker round trips.
vi.setConfig({ testTimeout: 15_000 });

it.effect(
	"placing, moving and removing opaque items preserve identity and raw fields through reversal",
	() =>
		Effect.gen(function* () {
			const fixture = inventoryFixture();
			if (
				!Array.isArray(fixture.SaveGame.farmhands) ||
				!fixture.SaveGame.farmhands[0]
			)
				throw new Error("Missing fixture guest");
			fixture.SaveGame.farmhands[0].items!.push(null);
			const session = yield* makeHistorySession(fixture);
			const opaque = {
				$type: "$unknown",
				$xmlType: { name: "CustomModItem", namespace: "" },
				customModData: { version: "007" },
				unknown: [1, { keep: true }],
			};
			yield* session.execute([
				{ type: "item-place", ownerId: "1", slot: 2, item: opaque },
			]);
			const placed = yield* session.snapshot;
			// A real identity is required so the move exercises handle-based targeting.
			const entityId = placed.identities["1"]?.[2];
			expect(entityId).toBeDefined();
			yield* session.execute([
				{
					type: "item-move",
					ownerId: "1",
					slot: 0,
					entityId,
					toOwnerId: "2",
					toSlot: 1,
				},
			]);
			const moved = yield* session.snapshot;
			expect(moved.identities["2"]?.[1]).toBe(entityId);
			expect(moved.document.SaveGame.player.items[2]).toBeNull();
			if (!Array.isArray(moved.document.SaveGame.farmhands))
				throw new Error("Missing guest");
			expect(moved.document.SaveGame.farmhands[0]?.items?.[1]).toEqual(opaque);
			yield* session.execute([
				{ type: "item-remove", ownerId: "2", slot: 0, entityId },
			]);
			expect((yield* session.snapshot).identities["2"]?.[1]).not.toBe(entityId);
			yield* session.undo;
			expect((yield* session.snapshot).identities["2"]?.[1]).toBe(entityId);
			yield* session.undo;
			expect((yield* session.snapshot).identities["1"]?.[2]).toBe(entityId);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(fixture);
			yield* session.redo;
			yield* session.redo;
			yield* session.redo;
			expect((yield* session.snapshot).cursor).toBe(3);
		}),
);

it.effect(
	"failed placements/transfers publish no partial state and abandoned identities are never reused",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const before = yield* session.snapshot;
			for (const action of [
				{
					type: "item-place",
					ownerId: "1",
					slot: 0,
					item: { custom: true },
				},
				{
					type: "item-place",
					ownerId: "1",
					slot: 2,
					item: { bad: undefined },
				},
				{
					type: "item-move",
					ownerId: "1",
					slot: 0,
					toOwnerId: "2",
					toSlot: 0,
				},
				{ type: "item-remove", ownerId: "1", slot: 99 },
			] as const) {
				expect(
					Exit.isFailure(yield* Effect.exit(session.execute([action]))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}
			yield* session.execute([
				{ type: "item-place", ownerId: "1", slot: 2, item: { custom: 1 } },
			]);
			const abandoned = (yield* session.snapshot).identities["1"]?.[2];
			expect(abandoned).toBeDefined();
			yield* session.undo;
			yield* session.execute([
				{ type: "item-place", ownerId: "1", slot: 2, item: { custom: 2 } },
			]);
			expect((yield* session.snapshot).identities["1"]?.[2]).not.toBe(
				abandoned,
			);
			expect((yield* session.snapshot).entries).toHaveLength(1);
		}),
);

it.effect(
	"identical items retain distinct identity through reorder, edits and undo/redo",
	() =>
		Effect.gen(function* () {
			const document = inventoryFixture();
			document.SaveGame.player.items[1] = structuredClone(
				document.SaveGame.player.items[0]!,
			);
			const session = yield* makeHistorySession(document);
			const original = yield* session.snapshot;
			// Both populated fixture slots must receive identities before reordering.
			const identities = original.identities["1"];
			if (!identities) throw new Error("Missing host identities");
			const [first, second] = identities;
			expect(first).toBeDefined();
			expect(second).toBeDefined();
			expect(first).not.toBe(second);
			yield* session.execute([
				{ type: "reorder", ownerId: "1", order: [1, 0, 2] },
			]);
			const moved = yield* session.snapshot;
			expect(moved.document).toEqual(document);
			expect(moved.identities["1"]).toEqual([
				second,
				first,
				original.identities["1"]?.[2],
			]);
			expect(moved.entries).toHaveLength(1);
			expect((yield* session.review).net).toEqual([]);
			// The old slot is deliberately wrong: the entity handle resolves the target.
			yield* session.execute([
				{
					type: "item-stack",
					ownerId: "1",
					slot: 0,
					itemId: "72",
					entityId: first,
					value: 9,
				},
			]);
			const changed = yield* session.snapshot;
			expect(changed.document.SaveGame.player.items[0]).toMatchObject({
				stack: 2,
			});
			expect(changed.document.SaveGame.player.items?.[1]).toMatchObject({
				stack: 9,
			});
			yield* session.undo;
			yield* session.undo;
			expect((yield* session.snapshot).identities).toEqual(original.identities);
			yield* session.redo;
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(changed.document);
			expect((yield* session.snapshot).identities).toEqual(changed.identities);
			expect(stringifySavedData(changed.document)).not.toContain("entityId");
		}),
);

it.effect(
	"identity and document changes roll back together when a compound action fails",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const before = yield* session.snapshot;
			const failure = yield* Effect.exit(
				session.execute([
					{ type: "reorder", ownerId: "1", order: [2, 1, 0] },
					{
						type: "item-stack",
						ownerId: "1",
						slot: 0,
						itemId: "72",
						entityId: "missing",
						value: 10,
					},
				]),
			);
			expect(Exit.isFailure(failure)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}),
);
