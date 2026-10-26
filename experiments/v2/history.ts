import {
	Effect,
	JsonPatch,
	Schema,
	Stream,
	TxSubscriptionRef,
	Option,
} from "effect";
import { coreOperations, EditorOperations } from "./operations.ts";
import {
	type Mutation,
	MutationError,
	farmers,
	type Receipt,
	type SaveDocument,
	type DomainState,
	type SessionState,
} from "./domain.ts";

interface Entry {
	bytes: number;
	domainBefore: DomainState;
	domainAfter: DomainState;
	identitiesBefore: Record<string, string[]>;
	identitiesAfter: Record<string, string[]>;
	id: number;
	intent: Omit<Receipt, "changes">;
	actions: readonly Mutation[];
	forward: JsonPatch.JsonPatch;
	backward: JsonPatch.JsonPatch;
}
interface History {
	domainState: DomainState;
	retainedBytes: number;
	nextIdentity: number;
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
const json = (value: SaveDocument | DomainState) =>
	value as unknown as Schema.Json;
const isDomainState = (value: unknown): value is DomainState =>
	value !== null &&
	typeof value === "object" &&
	!Array.isArray(value) &&
	Schema.is(Schema.Json)(value);

export interface HistoryLimits {
	entries?: number;
	bytes?: number;
}

// Bound serialized entry payloads (including identities and intent), not JS heap
// overhead or the baseline/current document. Count the size field itself too.
function entryBytes(payload: Omit<Entry, "bytes">): number {
	const base = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
	const prefix = ',"bytes":'.length;
	let size = base + prefix + 1;
	while (size !== base + prefix + String(size).length)
		size = base + prefix + String(size).length;
	return size;
}

export const makeHistorySession = (
	document: SaveDocument,
	limits: number | HistoryLimits = {},
	initialDomainState: DomainState = {},
) =>
	Effect.gen(function* () {
		const operations = Option.getOrElse(
			yield* Effect.serviceOption(EditorOperations),
			() => coreOperations,
		);
		const limit = typeof limits === "number" ? limits : (limits.entries ?? 100);
		const byteLimit =
			typeof limits === "number"
				? 8 * 1024 * 1024
				: (limits.bytes ?? 8 * 1024 * 1024);
		if (!Number.isInteger(limit) || limit < 1)
			return yield* Effect.fail(
				new MutationError("History limit must be a positive integer"),
			);
		if (!Number.isSafeInteger(byteLimit) || byteLimit < 1)
			return yield* Effect.fail(
				new MutationError(
					"History byte budget must be a positive safe integer",
				),
			);
		if (!Schema.is(Schema.Json)(document))
			return yield* Effect.fail(
				new MutationError("History requires plain JSON save data"),
			);
		const baseline = structuredClone(document);
		if (!isDomainState(initialDomainState))
			return yield* Effect.fail(
				new MutationError("Domain state requires plain JSON data"),
			);
		// Item IDs describe types, not instances. Allocate session-only handles,
		// including opaque/empty slots, without adding fields to the exported save.
		let nextIdentity = 0;
		const identities: Record<string, string[]> = Object.create(null);
		for (const farmer of farmers(baseline)) {
			const id = String(farmer.UniqueMultiplayerID);
			if (Object.hasOwn(identities, id))
				return yield* Effect.fail(
					new MutationError("Farmer ID must resolve exactly once"),
				);
			identities[id] = farmer.items.Item.map(() => `item:${++nextIdentity}`);
		}
		const ref = yield* TxSubscriptionRef.make<History>({
			domainState: structuredClone(initialDomainState),
			retainedBytes: 0,
			nextIdentity,
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
			change: (
				state: History,
			) => History | Effect.Effect<History, MutationError>,
			expectedRevision?: number,
		) =>
			Effect.tx(
				Effect.gen(function* () {
					const state = yield* TxSubscriptionRef.get(ref);
					const proposed = yield* Effect.try({
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
					const next = Effect.isEffect(proposed) ? yield* proposed : proposed;
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
				update(
					(state) =>
						Effect.gen(function* () {
							if (actions.length === 0) return state;
							// A replaceable adapter may stage in-place writes. Never give it
							// references to published state, including before a later failure.
							let prepared: SessionState = {
								document: structuredClone(state.document),
								domainState: structuredClone(state.domainState),
								history: [] as Receipt[],
							};
							let identities = state.identities;
							let nextIdentity = state.nextIdentity;
							const resolved: Mutation[] = [];
							for (const requested of structuredClone(actions)) {
								let action = requested;
								if (
									(requested.type === "item-stack" ||
										requested.type === "item-remove" ||
										requested.type === "item-move") &&
									requested.entityId !== undefined
								) {
									const slot =
										identities[requested.farmerId]?.indexOf(
											requested.entityId,
										) ?? -1;
									if (slot < 0)
										throw new MutationError(
											"Item no longer belongs to this farmer",
										);
									action = { ...requested, slot };
								}
								const previousDomain = prepared.domainState ?? {};
								const result = yield* operations.prepare(prepared, action);
								prepared = {
									...result,
									domainState:
										result.domainState === undefined
											? previousDomain
											: result.domainState,
								};
								if (
									!Schema.is(Schema.Json)(prepared.document) ||
									!isDomainState(prepared.domainState)
								)
									throw new MutationError(
										"Prepared document and domain state require plain JSON data",
									);
								if (
									action.type === "item-place" &&
									!Schema.is(Schema.Json)(action.item)
								)
									throw new MutationError(
										"Placed items require plain JSON save data",
									);
								resolved.push(action);
								if (
									action.type === "item-place" ||
									action.type === "item-remove"
								) {
									const slots = [...identities[action.farmerId]];
									slots[action.slot] = `item:${++nextIdentity}`;
									identities = { ...identities, [action.farmerId]: slots };
								}
								if (action.type === "item-move") {
									// Handles travel with the records, even across farmer inventories.
									identities = structuredClone(identities);
									const source = identities[action.farmerId];
									const target = identities[action.toFarmerId];
									[source[action.slot], target[action.toSlot]] = [
										target[action.toSlot],
										source[action.slot],
									];
								}
								if (action.type === "reorder") {
									const before = identities[action.farmerId];
									identities = {
										...identities,
										[action.farmerId]: action.order.map((slot) => before[slot]),
									};
								}
							}
							// Detach published state from drafts retained by an adapter.
							prepared = structuredClone(prepared);
							const forward = JsonPatch.get(
								json(state.document),
								json(prepared.document),
							);
							// Swapping byte-identical items still moves distinct session entities.
							// Keep that undoable even when the XML has no net difference.
							if (
								forward.length === 0 &&
								JsonPatch.get(
									json(state.domainState),
									json(prepared.domainState ?? {}),
								).length === 0 &&
								JSON.stringify(identities) === JSON.stringify(state.identities)
							)
								return state;
							const receipts = prepared.history;
							const first = receipts[0] ?? {
								intent:
									resolved.find((action) => action.type === "reorder") ??
									resolved[0],
								label: resolved.some((action) => action.type === "reorder")
									? "Reorder backpack"
									: "Edit save",
								review: "compact" as const,
							};
							const payload: Omit<Entry, "bytes"> = {
								domainBefore: state.domainState,
								domainAfter: prepared.domainState ?? {},
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
							const entry: Entry = { ...payload, bytes: entryBytes(payload) };
							// Reject one oversized operation before publishing anything. Silently
							// applying an action that cannot be undone would be misleading.
							if (entry.bytes > byteLimit)
								throw new MutationError(
									"This action exceeds the undo history byte budget",
								);
							const entries = [...state.entries.slice(0, state.cursor), entry];
							let retainedBytes = entries.reduce(
								(total, entry) => total + entry.bytes,
								0,
							);
							let evict = 0;
							while (
								entries.length - evict > limit ||
								retainedBytes > byteLimit
							) {
								retainedBytes -= entries[evict].bytes;
								evict++;
							}
							return {
								...state,
								retainedBytes,
								domainState: prepared.domainState ?? {},
								identities,
								nextIdentity,
								document: prepared.document,
								entries: entries.slice(evict),
								cursor: entries.length - evict,
								nextId: state.nextId + 1,
								dropped: state.dropped + evict,
							};
						}).pipe(
							Effect.catchDefect((error) =>
								Effect.fail(
									error instanceof MutationError
										? error
										: new MutationError(String(error)),
								),
							),
						),
					expectedRevision,
				),
			undo: update((state) => {
				if (state.cursor === 0) return state;
				const entry = state.entries[state.cursor - 1];
				return {
					...state,
					identities: entry.identitiesBefore,
					domainState: entry.domainBefore,
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
					domainState: entry.domainAfter,
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
