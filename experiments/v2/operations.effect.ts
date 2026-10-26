import { expect, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { MutationError } from "./domain.ts";
import { makeHistorySession } from "./history.ts";
import { inventoryFixture } from "./inventory-model.ts";
import { coreOperations, EditorOperations } from "./operations.ts";

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
					{ type: "money", farmerId: "host", value: 50 },
					{ type: "farm-name", value: "Rejected group" },
				]),
			);
			expect(Exit.isFailure(result)).toBe(true);
			expect(calls).toBe(2);
			expect(yield* session.snapshot).toEqual(before);
		}).pipe(Effect.provide(layer));
	},
);
