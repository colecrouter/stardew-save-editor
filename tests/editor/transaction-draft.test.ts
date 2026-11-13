import { Effect, Result } from "effect";
import { it } from "@effect/vitest";
import { expect } from "vitest";
import {
	makeTransactionDraft,
	makeTransactionDraftFromCommitted,
} from "../../src/lib/editor/transaction-draft";
import type { SessionState } from "../../src/lib/editor/domain";
import { tinyFixture } from "../helpers/editor-document.ts";

it.effect(
	"borrows committed branches privately while isolating reads and submitted patch values",
	() =>
		Effect.gen(function* () {
			const initial: SessionState = {
				document: tinyFixture(),
				history: [],
				domainState: {},
			};
			const original = structuredClone(initial);
			const draft = makeTransactionDraftFromCommitted(initial);
			const snapshot = yield* draft.service.read;
			// The program can mutate its read without touching staging or committed data.
			snapshot.state.document.SaveGame.player.farmName = "Changed";
			const inserted = { values: ["kept"] };
			Object.assign(snapshot.state.document.SaveGame, { custom: inserted });
			expect(initial).toEqual(original);
			expect((yield* draft.prepared).document).toBe(initial.document);
			yield* draft.service.replace(snapshot);
			const prepared = yield* draft.prepared;
			// Unchanged opaque items remain shared only inside the owner boundary; public
			// reads and submitted inserted records must never alias those internal values.
			expect(prepared.document.SaveGame.player.items).toBe(
				initial.document.SaveGame.player.items,
			);
			expect(prepared.document.SaveGame.player.farmName).toBe("Changed");
			expect(initial).toEqual(original);
			inserted.values[0] = "mutated after replace";
			snapshot.state.document.SaveGame.player.items.length = 0;
			expect(prepared.document.SaveGame).toMatchObject({
				custom: { values: ["kept"] },
			});
			expect(prepared.document.SaveGame.player.items).toEqual(
				original.document.SaveGame.player.items,
			);
			const anotherRead = yield* draft.service.read;
			anotherRead.state.document.SaveGame.player.items.length = 0;
			expect(prepared.document.SaveGame.player.items).toEqual(
				original.document.SaveGame.player.items,
			);
			yield* draft.close;
			expect(Result.isFailure(yield* Effect.result(draft.service.read))).toBe(
				true,
			);
		}),
);

it.effect(
	"keeps the general constructor detached and preserves conflict/no-op version semantics",
	() =>
		Effect.gen(function* () {
			const initial: SessionState = { document: tinyFixture(), history: [] };
			const original = structuredClone(initial);
			const draft = makeTransactionDraft(initial);
			initial.document.SaveGame.player.name = "External mutation";
			const first = yield* draft.service.read;
			expect(first.state).toEqual(original);
			// Even an equal replacement consumes its captured version, exactly as before.
			yield* draft.service.replace(first);
			const stale = yield* Effect.result(draft.service.replace(first));
			expect(Result.isFailure(stale)).toBe(true);
			const current = yield* draft.service.read;
			expect(current.version).toBe(first.version + 1);
			// Invalid saved values is rejected before staging; the prior accepted state survives.
			Object.assign(current.state.document.SaveGame, { invalid: undefined });
			expect(
				Result.isFailure(yield* Effect.result(draft.service.replace(current))),
			).toBe(true);
			expect(yield* draft.prepared).toEqual(original);
			yield* draft.close;
		}),
);
