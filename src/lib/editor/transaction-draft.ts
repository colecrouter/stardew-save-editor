import { cloneEditorData } from "./clone-data.ts";
import { Context, Effect, Schema, JsonPatch } from "effect";
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

/**
 * Create one transaction attempt's isolated, versioned staging capability.
 * Reads are detached snapshots; replacement checks their captured version.
 * The owner must finalize `close` after capture or failure so escaped services
 * cannot retain or update an abandoned draft. This does not publish a commit.
 */
export function makeTransactionDraft(initial: SessionState) {
	// General factory callers keep their own mutable data. Isolate it before
	// constructing the capability so later caller writes cannot alter the draft.
	return stageTransactionDraft(cloneEditorData(initial));
}

/** History-only construction from a stable, session-owned committed snapshot.
 * The owner must not mutate this baseline. Programs still receive detached reads;
 * no service method exposes or mutates the borrowed committed objects. */
export function makeTransactionDraftFromCommitted(initial: SessionState) {
	return stageTransactionDraft(initial);
}

function stageTransactionDraft(initial: SessionState) {
	let state: SessionState | undefined = initial;
	let version = 0;
	let active = true;
	// Capture is lazy: validation is an expected failure, cloning validated JSON
	// is an invariant. Unexpected clone exceptions remain defects.
	const read = Effect.gen(function* () {
		if (!active || !state)
			return yield* new MutationError("This transaction draft is closed");
		return { version, state: cloneEditorData(state) };
	});
	return {
		service: {
			read,
			replace: Effect.fn("TransactionDraft.replace")(function* (
				next: DraftSnapshot,
			) {
				if (!active || !state)
					return yield* new MutationError("This transaction draft is closed");
				if (next.version !== version)
					return yield* new MutationError(
						"Another operation changed this transaction draft",
					);
				if (!Schema.is(Schema.Json)(next.state))
					return yield* new MutationError(
						"Transaction drafts require plain JSON state",
					);
				// A program may retain and mutate its submitted snapshot later. Copy
				// changed values, then replay them onto the stable staged baseline.
				// Unchanged branches stay owned internally; no submitted reference
				// becomes authoritative. This also preserves sharing for history diffs.
				const patch = cloneEditorData(
					JsonPatch.get(
						state as unknown as Schema.Json,
						next.state as unknown as Schema.Json,
					),
				);
				// The patch was derived from validated SessionState values, so replay
				// preserves that envelope even though JsonPatch forgets its root type.
				state = JsonPatch.apply(
					patch,
					state as unknown as Schema.Json,
				) as unknown as SessionState;
				version++;
			}),
		},
		// History captures the prepared state before finalization clears the capability.
		prepared: Effect.gen(function* () {
			if (!active || !state)
				return yield* new MutationError("This transaction draft is closed");
			return state;
		}),
		// Escaped services become inert on both successful and failed transactions.
		close: Effect.sync(() => {
			active = false;
			state = undefined;
		}),
	};
}
