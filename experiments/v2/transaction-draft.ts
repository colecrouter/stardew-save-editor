import { Context, Effect, Schema } from "effect";
import { MutationError, type SessionState } from "./domain.ts";

// A domain operation receives a detached snapshot and submits its replacement
// against that snapshot's version. Concurrent substeps cannot silently overwrite
// a newer draft; a conflict rejects the whole enclosing transaction.
export interface DraftSnapshot {
	readonly version: number;
	readonly state: SessionState;
}
export class TransactionDraft extends Context.Service<
	TransactionDraft,
	{
		read: Effect.Effect<DraftSnapshot, MutationError>;
		replace: (snapshot: DraftSnapshot) => Effect.Effect<void, MutationError>;
	}
>()("v2/TransactionDraft") {}

export function makeTransactionDraft(initial: SessionState) {
	let state: SessionState | undefined = structuredClone(initial);
	let version = 0;
	let active = true;
	// Capture is lazy: validation is an expected failure, cloning validated JSON
	// is an invariant. Unexpected clone exceptions remain defects.
	const read = Effect.gen(function* () {
		if (!active || !state)
			return yield* Effect.fail(
				new MutationError("This transaction draft is closed"),
			);
		return { version, state: structuredClone(state) };
	});
	return {
		service: {
			read,
			replace: Effect.fn("TransactionDraft.replace")(function* (
				next: DraftSnapshot,
			) {
				if (!active || !state)
					return yield* Effect.fail(
						new MutationError("This transaction draft is closed"),
					);
				if (next.version !== version)
					return yield* Effect.fail(
						new MutationError(
							"Another operation changed this transaction draft",
						),
					);
				if (!Schema.is(Schema.Json)(next.state))
					return yield* Effect.fail(
						new MutationError("Transaction drafts require plain JSON state"),
					);
				state = structuredClone(next.state);
				version++;
			}),
		},
		// History captures the prepared state before finalization clears the capability.
		prepared: Effect.gen(function* () {
			if (!active || !state)
				return yield* Effect.fail(
					new MutationError("This transaction draft is closed"),
				);
			return state;
		}),
		// Escaped services become inert on both successful and failed transactions.
		close: Effect.sync(() => {
			active = false;
			state = undefined;
		}),
	};
}
