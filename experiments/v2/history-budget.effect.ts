import { expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { makeHistorySession } from "./history.ts";
import { inventoryFixture } from "./inventory-model.ts";

const money = (value: number) =>
	({ type: "money", farmerId: "host", value }) as const;

it.effect(
	"byte retention evicts oldest entries while preserving complete baseline review",
	() =>
		Effect.gen(function* () {
			const reference = yield* makeHistorySession(inventoryFixture());
			yield* reference.execute([money(20)]);
			yield* reference.execute([money(30)]);
			const both = yield* reference.snapshot;
			const limit = both.retainedBytes - 1;
			const session = yield* makeHistorySession(inventoryFixture(), {
				bytes: limit,
			});
			yield* session.execute([money(20)]);
			yield* session.execute([money(30)]);
			const state = yield* session.snapshot;
			expect(state.entries).toHaveLength(1);
			expect(state.dropped).toBe(1);
			expect(state.retainedBytes).toBeLessThanOrEqual(limit);
			expect((yield* session.review).net).toEqual(
				(yield* reference.review).net,
			);
			yield* session.undo;
			expect((yield* session.snapshot).document.SaveGame.player.money).toBe(20);
		}),
);

it.effect(
	"an oversized action preserves document, identities, undo and redo state",
	() =>
		Effect.gen(function* () {
			const reference = yield* makeHistorySession(inventoryFixture());
			yield* reference.execute([money(20)]);
			const budget = (yield* reference.snapshot).retainedBytes + 100;
			const session = yield* makeHistorySession(inventoryFixture(), {
				bytes: budget,
			});
			yield* session.execute([money(20)]);
			yield* session.undo;
			const before = yield* session.snapshot;
			const result = yield* Effect.exit(
				session.execute([
					{
						type: "item-place",
						farmerId: "host",
						slot: 2,
						item: { modData: "x".repeat(budget * 2) },
					},
				]),
			);
			expect(Exit.isFailure(result)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			yield* session.redo;
			expect((yield* session.snapshot).document.SaveGame.player.money).toBe(20);
		}),
);

it.effect(
	"entry accounting includes UTF-8 metadata and keeps hostile dictionary keys as data",
	() =>
		Effect.gen(function* () {
			const fixture = inventoryFixture();
			fixture.SaveGame.player.UniqueMultiplayerID = "__proto__";
			const session = yield* makeHistorySession(fixture);
			yield* session.execute([{ type: "farm-name", value: "🌻農場" }]);
			const state = yield* session.snapshot;
			expect(state.identities.__proto__).toHaveLength(3);
			expect(state.retainedBytes).toBe(
				new TextEncoder().encode(JSON.stringify(state.entries[0])).byteLength,
			);
		}),
);
