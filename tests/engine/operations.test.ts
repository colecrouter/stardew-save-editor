import { vi } from "vitest";
import { expect, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { MutationError } from "../../src/lib/editor/domain.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { inventoryFixture } from "./inventory-model.ts";
import {
	coreOperations,
	EditorOperations,
} from "../../src/lib/editor/operations.ts";

// Retain the engine suite's budget for full-save codecs and worker round trips.
vi.setConfig({ testTimeout: 15_000 });

it.effect(
	"actual patches expose adapter writes even when receipts omit or misdescribe them",
	() => {
		const layer = Layer.succeed(EditorOperations, {
			prepare: (state) =>
				Effect.sync(() => {
					const document = structuredClone(state.document);
					document.SaveGame.player.money = 78;
					document.SaveGame.player.farmName = "Unexpected adapter write";
					return { ...state, document }; // Deliberately no receipt.
				}),
		});
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const before = yield* session.snapshot;
			const after = yield* session.execute([
				{ type: "money", farmerId: "1", value: 78 },
			]);
			expect(after.entries[0]?.intent).toMatchObject({
				label: "Unlabelled changes",
				review: "standalone",
			});
			expect((yield* session.review).net.map((patch) => patch.path)).toContain(
				"/SaveGame/player/farmName",
			);
			expect((yield* session.undo).document).toEqual(before.document);
		}).pipe(Effect.provide(layer));
	},
);

it.effect(
	"a session captures its domain service and rolls back a failed compound preparation",
	() => {
		let calls = 0;
		const layer = Layer.succeed(EditorOperations, {
			prepare: (state, action) => {
				calls++;
				return calls === 2
					? Effect.fail(
							new MutationError("adapter rejected the second operation"),
						)
					: coreOperations.prepare(state, action);
			},
		});
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const before = yield* session.snapshot;
			const result = yield* Effect.exit(
				session.execute([
					{ type: "money", farmerId: "1", value: 50 },
					{ type: "farm-name", value: "Rejected group" },
				]),
			);
			expect(Exit.isFailure(result)).toBe(true);
			expect(calls).toBe(2);
			expect(yield* session.snapshot).toEqual(before);
		}).pipe(Effect.provide(layer));
	},
);
