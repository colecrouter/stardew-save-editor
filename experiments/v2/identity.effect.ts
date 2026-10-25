import { expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { makeHistorySession } from "./history.ts";
import { inventoryFixture } from "./inventory-model.ts";

it.effect(
	"identical items retain distinct identity through reorder, edits and undo/redo",
	() =>
		Effect.gen(function* () {
			const document = inventoryFixture();
			document.SaveGame.player.items.Item[1] = structuredClone(
				document.SaveGame.player.items.Item[0],
			);
			const session = yield* makeHistorySession(document);
			const original = yield* session.snapshot;
			const [first, second] = original.identities.host;
			expect(first).not.toBe(second);
			yield* session.execute([
				{ type: "reorder", farmerId: "host", order: [1, 0, 2] },
			]);
			const moved = yield* session.snapshot;
			expect(moved.document).toEqual(document);
			expect(moved.identities.host).toEqual([
				second,
				first,
				original.identities.host[2],
			]);
			expect(moved.entries).toHaveLength(1);
			expect((yield* session.review).net).toEqual([]);
			// The old slot is deliberately wrong: the entity handle resolves the target.
			yield* session.execute([
				{
					type: "item-stack",
					farmerId: "host",
					slot: 0,
					itemId: "72",
					entityId: first,
					value: 9,
				},
			]);
			const changed = yield* session.snapshot;
			expect(changed.document.SaveGame.player.items.Item[0]).toMatchObject({
				stack: 2,
			});
			expect(changed.document.SaveGame.player.items.Item[1]).toMatchObject({
				stack: 9,
			});
			yield* session.undo;
			yield* session.undo;
			expect((yield* session.snapshot).identities).toEqual(original.identities);
			yield* session.redo;
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(changed.document);
			expect((yield* session.snapshot).identities).toEqual(changed.identities);
			expect(JSON.stringify(changed.document)).not.toContain("entityId");
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
					{ type: "reorder", farmerId: "host", order: [2, 1, 0] },
					{
						type: "item-stack",
						farmerId: "host",
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
