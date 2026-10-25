import { Effect, JsonPatch, Schema, Stream, TxSubscriptionRef } from "effect";
import {
	type Mutation,
	MutationError,
	prepare,
	farmers,
	type Receipt,
	type SaveDocument,
} from "./domain.ts";

interface Entry {
	identitiesBefore: Record<string, string[]>;
	identitiesAfter: Record<string, string[]>;
	id: number;
	intent: Omit<Receipt, "changes">;
	actions: readonly Mutation[];
	forward: JsonPatch.JsonPatch;
	backward: JsonPatch.JsonPatch;
}
interface History {
	identities: Record<string, string[]>;
	revision: number;
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
		// Item IDs describe types, not instances. Allocate session-only handles,
		// including opaque/empty slots, without adding fields to the exported save.
		let nextIdentity = 0;
		const identities: Record<string, string[]> = {};
		for (const farmer of farmers(baseline)) {
			const id = String(farmer.UniqueMultiplayerID);
			if (Object.hasOwn(identities, id))
				return yield* Effect.fail(
					new MutationError("Farmer ID must resolve exactly once"),
				);
			identities[id] = farmer.items.Item.map(() => `item:${++nextIdentity}`);
		}
		const ref = yield* TxSubscriptionRef.make<History>({
			identities,
			revision: 0,
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

		const update = (
			change: (state: History) => History,
			expectedRevision?: number,
		) =>
			Effect.tx(
				Effect.gen(function* () {
					const state = yield* TxSubscriptionRef.get(ref);
					const next = yield* Effect.try({
						try: () => {
							if (closed) throw new MutationError("Session closed");
							// A draft cannot commit against a document changed since it opened,
							// including an undo/redo cycle returning to the same visible value.
							if (
								expectedRevision !== undefined &&
								state.revision !== expectedRevision
							)
								throw new MutationError(
									"The save changed while editing. Reload the current value.",
								);
							return change(state);
						},
						catch: (error) =>
							error instanceof MutationError
								? error
								: new MutationError(String(error)),
					});
					const published =
						next === state ? state : { ...next, revision: state.revision + 1 };
					if (published !== state) yield* TxSubscriptionRef.set(ref, published);
					return structuredClone(published);
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
			execute: (
				actions: readonly Mutation[],
				label?: string,
				expectedRevision?: number,
			) =>
				update((state) => {
					if (actions.length === 0) return state;
					let prepared = { document: state.document, history: [] as Receipt[] };
					let identities = state.identities;
					const resolved: Mutation[] = [];
					for (const requested of actions) {
						let action = requested;
						if (
							requested.type === "item-stack" &&
							requested.entityId !== undefined
						) {
							const slot =
								identities[requested.farmerId]?.indexOf(requested.entityId) ??
								-1;
							if (slot < 0)
								throw new MutationError(
									"Item no longer belongs to this farmer",
								);
							action = { ...requested, slot };
						}
						prepared = prepare(prepared, action);
						resolved.push(action);
						if (action.type === "reorder") {
							const before = identities[action.farmerId];
							identities = {
								...identities,
								[action.farmerId]: action.order.map((slot) => before[slot]),
							};
						}
					}
					const forward = JsonPatch.get(
						json(state.document),
						json(prepared.document),
					);
					// Swapping byte-identical items still moves distinct session entities.
					// Keep that undoable even when the XML has no net difference.
					if (
						forward.length === 0 &&
						JSON.stringify(identities) === JSON.stringify(state.identities)
					)
						return state;
					const receipts = prepared.history;
					const first = receipts[0] ?? {
						intent:
							resolved.find((action) => action.type === "reorder") ??
							resolved[0],
						label: "Reorder backpack",
						review: "compact" as const,
					};
					const entry: Entry = {
						identitiesBefore: state.identities,
						identitiesAfter: identities,
						id: state.nextId,
						actions: structuredClone(resolved),
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
						identities,
						document: prepared.document,
						entries: entries.slice(evict),
						cursor: entries.length - evict,
						nextId: state.nextId + 1,
						dropped: state.dropped + evict,
					};
				}, expectedRevision),
			undo: update((state) => {
				if (state.cursor === 0) return state;
				const entry = state.entries[state.cursor - 1];
				return {
					...state,
					identities: entry.identitiesBefore,
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
					identities: entry.identitiesAfter,
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
