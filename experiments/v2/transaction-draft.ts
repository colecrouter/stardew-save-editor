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
	return {
		service: {
			read: Effect.try({
				try: () => {
					if (!active || !state)
						throw new MutationError("This transaction draft is closed");
					return { version, state: structuredClone(state) };
				},
				catch: (cause) =>
					cause instanceof MutationError
						? cause
						: new MutationError(String(cause)),
			}),
			replace: (next: DraftSnapshot) =>
				Effect.try({
					try: () => {
						if (!active || !state)
							throw new MutationError("This transaction draft is closed");
						if (next.version !== version)
							throw new MutationError(
								"Another operation changed this transaction draft",
							);
						// Preserve raw JSON, including opaque fields. Reject resource handles
						// rather than serializing them away or retaining them in history.
						if (!Schema.is(Schema.Json)(next.state))
							throw new MutationError(
								"Transaction drafts require plain JSON state",
							);
						state = structuredClone(next.state);
						version++;
					},
					catch: (cause) =>
						cause instanceof MutationError
							? cause
							: new MutationError(String(cause)),
				}),
		},
		// History reads this only after every operation has succeeded. The final
		// commit detaches again so adapter-retained snapshots never own live state.
		prepared: () => {
			if (!state) throw new MutationError("This transaction draft is closed");
			return state;
		},
		// Detached services retained by a child fiber must not report successful
		// staging after the parent program has finished or failed.
		close: () => {
			active = false;
			state = undefined;
		},
	};
}
