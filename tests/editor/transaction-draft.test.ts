import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
	makeTransactionDraft,
	makeTransactionDraftFromCommitted,
} from "../../src/lib/editor/transaction-draft";
import type { SessionState } from "../../src/lib/editor/domain";
import { tinyFixture } from "./fixtures";

it("borrows committed branches privately while isolating reads and submitted patch values", async () => {
	const initial: SessionState = {
		document: tinyFixture(),
		history: [],
		domainState: {},
	};
	const original = structuredClone(initial);
	const draft = makeTransactionDraftFromCommitted(initial);
	const snapshot = await Effect.runPromise(draft.service.read);
	// The program can mutate its read without touching staging or committed data.
	snapshot.state.document.SaveGame.player.farmName = "Changed";
	const inserted = { values: ["kept"] };
	Object.assign(snapshot.state.document.SaveGame, { custom: inserted });
	expect(initial).toEqual(original);
	expect((await Effect.runPromise(draft.prepared)).document).toBe(
		initial.document,
	);
	await Effect.runPromise(draft.service.replace(snapshot));
	const prepared = await Effect.runPromise(draft.prepared);
	// Unchanged opaque items remain shared only inside the owner boundary; public
	// reads and submitted inserted records must never alias those internal values.
	expect(prepared.document.SaveGame.player.items).toBe(
		initial.document.SaveGame.player.items,
	);
	expect(prepared.document.SaveGame.player.farmName).toBe("Changed");
	expect(initial).toEqual(original);
	inserted.values[0] = "mutated after replace";
	snapshot.state.document.SaveGame.player.items.Item.length = 0;
	expect(prepared.document.SaveGame).toMatchObject({
		custom: { values: ["kept"] },
	});
	expect(prepared.document.SaveGame.player.items).toEqual(
		original.document.SaveGame.player.items,
	);
	const anotherRead = await Effect.runPromise(draft.service.read);
	anotherRead.state.document.SaveGame.player.items.Item.length = 0;
	expect(prepared.document.SaveGame.player.items).toEqual(
		original.document.SaveGame.player.items,
	);
	await Effect.runPromise(draft.close);
	expect(
		Result.isFailure(
			await Effect.runPromise(Effect.result(draft.service.read)),
		),
	).toBe(true);
});

it("keeps the general constructor detached and preserves conflict/no-op version semantics", async () => {
	const initial: SessionState = { document: tinyFixture(), history: [] };
	const original = structuredClone(initial);
	const draft = makeTransactionDraft(initial);
	initial.document.SaveGame.player.name = "External mutation";
	const first = await Effect.runPromise(draft.service.read);
	expect(first.state).toEqual(original);
	// Even an equal replacement consumes its captured version, exactly as before.
	await Effect.runPromise(draft.service.replace(first));
	const stale = await Effect.runPromise(
		Effect.result(draft.service.replace(first)),
	);
	expect(Result.isFailure(stale)).toBe(true);
	const current = await Effect.runPromise(draft.service.read);
	expect(current.version).toBe(first.version + 1);
	// Invalid JSON is rejected before staging; the prior accepted state survives.
	Object.assign(current.state.document.SaveGame, { invalid: undefined });
	expect(
		Result.isFailure(
			await Effect.runPromise(Effect.result(draft.service.replace(current))),
		),
	).toBe(true);
	expect(await Effect.runPromise(draft.prepared)).toEqual(original);
	await Effect.runPromise(draft.close);
});
