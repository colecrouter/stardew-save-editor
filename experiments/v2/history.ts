import { Effect, JsonPatch, Schema, Stream, TxSubscriptionRef } from "effect";
import {
	type Mutation,
	MutationError,
	prepare,
	type Receipt,
	type SaveDocument,
} from "./domain.ts";

interface Entry {
	id: number;
	intent: Omit<Receipt, "changes">;
	actions: readonly Mutation[];
	forward: JsonPatch.JsonPatch;
	backward: JsonPatch.JsonPatch;
}
interface History {
	document: SaveDocument;
	baseline: SaveDocument;
	entries: Entry[];
	cursor: number;
	nextId: number;
	dropped: number;
}

// Only parsed XML/JSON documents are supported, not live Svelte proxies, class
// instances, undefined fields, BigInts or cyclic graphs. Do not normalize such
// values with JSON.stringify: that would silently discard data.
const json = (document: SaveDocument) => document as unknown as Schema.Json;

export const makeHistorySession = (document: SaveDocument, limit = 100) =>
	Effect.gen(function* () {
		if (!Number.isInteger(limit) || limit < 1)
			return yield* Effect.fail(
				new MutationError("History limit must be a positive integer"),
			);
		if (!Schema.is(Schema.Json)(document))
			return yield* Effect.fail(
				new MutationError("History requires plain JSON save data"),
			);
		const baseline = structuredClone(document);
		const ref = yield* TxSubscriptionRef.make<History>({
			document: baseline,
			baseline,
			entries: [],
			cursor: 0,
			nextId: 1,
			dropped: 0,
		});
		let closed = false;
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				closed = true;
			}),
		);

		const update = (change: (state: History) => History) =>
			Effect.tx(
				Effect.gen(function* () {
					const state = yield* TxSubscriptionRef.get(ref);
					const next = yield* Effect.try({
						try: () => {
							if (closed) throw new MutationError("Session closed");
							return change(state);
						},
						catch: (error) =>
							error instanceof MutationError
								? error
								: new MutationError(String(error)),
					});
					if (next !== state) yield* TxSubscriptionRef.set(ref, next);
					return structuredClone(next);
				}),
			);

		return {
			snapshot: Effect.map(TxSubscriptionRef.get(ref), (state) =>
				structuredClone(state),
			),
			changes: Stream.map(TxSubscriptionRef.changesStream(ref), (state) =>
				structuredClone(state),
			),
			// A group has one undo boundary and one review emphasis. Each constituent
			// intent remains inspectable; a quiet operation never disappears from patches.
			execute: (actions: readonly Mutation[], label?: string) =>
				update((state) => {
					if (actions.length === 0) return state;
					let prepared = { document: state.document, history: [] as Receipt[] };
					for (const action of actions) prepared = prepare(prepared, action);
					const forward = JsonPatch.get(
						json(state.document),
						json(prepared.document),
					);
					if (forward.length === 0) return state;
					const receipts = prepared.history;
					const first = receipts[0];
					const entry: Entry = {
						id: state.nextId,
						actions: structuredClone(actions),
						intent: {
							intent: structuredClone(first.intent),
							label: label ?? first.label,
							review: receipts.some(
								(receipt) => receipt.review === "standalone",
							)
								? "standalone"
								: "compact",
						},
						forward,
						backward: JsonPatch.get(
							json(prepared.document),
							json(state.document),
						),
					};
					const entries = [...state.entries.slice(0, state.cursor), entry];
					const evict = Math.max(0, entries.length - limit);
					return {
						...state,
						document: prepared.document,
						entries: entries.slice(evict),
						cursor: entries.length - evict,
						nextId: state.nextId + 1,
						dropped: state.dropped + evict,
					};
				}),
			undo: update((state) => {
				if (state.cursor === 0) return state;
				const entry = state.entries[state.cursor - 1];
				return {
					...state,
					document: JsonPatch.apply(
						entry.backward,
						json(state.document),
					) as unknown as SaveDocument,
					cursor: state.cursor - 1,
				};
			}),
			redo: update((state) => {
				if (state.cursor === state.entries.length) return state;
				const entry = state.entries[state.cursor];
				return {
					...state,
					document: JsonPatch.apply(
						entry.forward,
						json(state.document),
					) as unknown as SaveDocument,
					cursor: state.cursor + 1,
				};
			}),
			review: Effect.map(TxSubscriptionRef.get(ref), (state) =>
				structuredClone({
					// Original import survives history eviction, so export review remains complete.
					net: JsonPatch.get(json(state.baseline), json(state.document)),
					entries: state.entries.slice(0, state.cursor),
					dropped: state.dropped,
				}),
			),
		};
	});
