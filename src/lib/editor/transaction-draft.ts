import { Context, Effect, Schema, JsonPatch } from "effect";
import { create as createCopyOnWrite } from "mutative";
import { freezeDraftState } from "./draft-state.ts";
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
		/** Synchronously edit private staging. Do not retain the writer or run effects
		 * inside it. Expected failures belong in the surrounding Effect program.
		 * Use ordinary JSON writes: cycles and frozen containers holding writers
		 * are recipe defects, not supported snapshot construction patterns.
		 * An expectedVersion ties a prepared edit to its earlier inspection; a
		 * mismatch rejects before the recipe runs, including no-op recipes. */
		mutate: (
			recipe: (state: SessionState) => undefined,
			expectedVersion?: number,
		) => Effect.Effect<void, MutationError>;
		replace: (snapshot: DraftSnapshot) => Effect.Effect<void, MutationError>;
	}
>()("v2/TransactionDraft") {}

/**
 * Create one transaction attempt's isolated, versioned staging capability.
 * Reads are detached snapshots; replacement checks their captured version.
 * Opt-in mutate callbacks are synchronous temporary writers, never snapshot values.
 * Owner-only inspect borrows frozen state and its version for engine checkouts;
 * it must not be exposed through the domain-program service.
 * The owner must finalize `close` after capture or failure so escaped services
 * cannot retain or update an abandoned draft. This does not publish a commit.
 */
export function makeTransactionDraft(initial: SessionState) {
	// General factory callers keep their own mutable data. Isolate it before
	// constructing the capability so later caller writes cannot alter the draft.
	return stageTransactionDraft(structuredClone(initial));
}

/** History-only construction from a stable, session-owned committed snapshot.
 * The owner must not mutate this baseline; synchronous mutation may deeply freeze
 * these owned objects. Ordinary reads still return detached mutable snapshots. */
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
		return { version, state: structuredClone(state) };
	});
	return {
		service: {
			read,
			mutate: Effect.fn("TransactionDraft.mutate")(function* (
				recipe: (state: SessionState) => undefined,
				expectedVersion?: number,
			) {
				if (!active || !state)
					return yield* new MutationError("This transaction draft is closed");
				// Metadata preparation may yield after checkout. Reject a stale
				// inspection before its recipe can read or modify the current writer.
				if (expectedVersion !== undefined && expectedVersion !== version)
					return yield* new MutationError(
						"Another operation changed this transaction draft",
					);
				const before = state;
				const capturedVersion = version;
				const run = (writer: SessionState) => {
					// Reject replacement/async recipes inside the producer so its
					// failure path revokes the temporary writer before returning.
					// This is a programmer-contract defect; expected failures stay
					// in the surrounding Effect program, outside the producer.
					if (recipe(writer) !== undefined)
						throw new Error(
							"Draft mutations must be synchronous and return no value",
						);
				};
				let next: SessionState;
				if (freezeDraftState(before)) {
					// Freezing protects owned branches even from reflective access.
					// Keep auto-freeze off: caller-inserted objects must remain theirs.
					// Keep Mutative's recursive mapped type outside the raw DTO's recursive
					// unions. This boundary preserves the same SessionState root shape.
					const base: object = before;
					const [prepared, assignments] = createCopyOnWrite(
						base,
						(writer) => run(writer as SessionState),
						{
							enablePatches: true,
							enableAutoFreeze: false,
						},
					);
					// Validate assigned values even if a structural diff would treat
					// an incompatible replacement as equal. Never walk the proxy graph.
					if (!Schema.is(Schema.Json)(assignments))
						return yield* new MutationError(
							"Transaction drafts require plain JSON state",
						);
					next = prepared as SessionState;
				} else {
					// Copy-on-write assumes a tree. Preserve existing alias-driven
					// mutation behavior for valid JSON DAGs through the detached path.
					next = structuredClone(before);
					run(next);
					if (!Schema.is(Schema.Json)(next))
						return yield* new MutationError(
							"Transaction drafts require plain JSON state",
						);
				}
				// A recipe normally cannot yield. This guard also rejects reentrant
				// service calls or close() invoked synchronously from its callback.
				if (!active || version !== capturedVersion)
					return yield* new MutationError(
						"Another operation changed this transaction draft",
					);
				// Effect owns patch semantics, including sparse-array rejection and
				// signed zero. Library patches are validation evidence, not replay data.
				const patch = JsonPatch.get(
					before as unknown as Schema.Json,
					next as unknown as Schema.Json,
				);
				if (!Schema.is(Schema.Json)(patch))
					return yield* new MutationError(
						"Transaction drafts require plain JSON state",
					);
				if (patch.length === 0) return;
				// Foreign inserted values must be detached before any become owned;
				// unchanged branches remain shared inside the stable staging boundary.
				state = JsonPatch.apply(
					structuredClone(patch),
					before as unknown as Schema.Json,
				) as unknown as SessionState;
				version++;
			}),
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
				const patch = structuredClone(
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
		// Owner-only inspection borrows a frozen baseline with its version. History
		// passes it only to the inventory engine, which detaches its narrow checkout
		// before metadata work. Domain programs keep the detached service.read API.
		inspect: Effect.gen(function* () {
			if (!active || !state)
				return yield* new MutationError("This transaction draft is closed");
			freezeDraftState(state);
			return { version, state };
		}),
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
