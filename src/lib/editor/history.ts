import { isInventoryMutation } from "./inventory-transition.ts";
import { inventoryContainers } from "./inventory-containers.ts";
import { equipmentSlots, type EquipmentIdentities } from "./equipment.ts";
import { resolveBackpackMove } from "./backpack-movement.ts";
import { resolveBackpackLifecycle } from "./backpack-lifecycle.ts";
import {
	BackpackItemEdits,
	makeBackpackItemEdits,
	sameChestProjectionInputs,
	backpackFarmers,
	hasBackpackFarmerId,
} from "./inventory-operations.ts";
import {
	Effect,
	JsonPatch,
	Schema,
	Stream,
	TxSubscriptionRef,
	Option,
	Result,
} from "effect";
import {
	collectTransactionMetadata,
	type ReviewMetadata,
	type ReviewJournal,
} from "./transaction-annotations.ts";
import { TransactionDraft, makeTransactionDraft } from "./transaction-draft.ts";
import { coreOperations, EditorOperations } from "./operations.ts";
import {
	type Mutation,
	MutationError,
	type Receipt,
	type SaveDocument,
	type DomainState,
	type SessionState,
} from "./domain.ts";

interface Entry {
	equipmentBefore: EquipmentIdentities;
	equipmentAfter: EquipmentIdentities;
	bytes: number;
	domainBefore: DomainState;
	domainAfter: DomainState;
	identitiesBefore: Record<string, string[]>;
	identitiesAfter: Record<string, string[]>;
	id: number;
	// Domain inputs remain typed at their call sites. History needs presentation
	// and an opaque operation identifier, not a union of every executable command.
	intent: {
		intent: { type: string };
		label: string;
		review: "standalone" | "compact";
	};
	annotations: readonly ReviewMetadata[];
	actions: readonly Mutation[];
	forward: JsonPatch.JsonPatch;
	backward: JsonPatch.JsonPatch;
}
interface History {
	// The baseline is retained only while one field gesture is open. Each write is
	// still atomic; this state describes Undo grouping, never an open transaction.
	editGroup?: { key: string; before: Omit<History, "editGroup"> };

	equipmentIdentities: EquipmentIdentities;
	domainState: DomainState;
	retainedBytes: number;
	nextIdentity: number;
	identities: Record<string, string[]>;
	revision: number;
	// Domain-input version survives snapshot detachment and skipped deliveries.
	chestRevision: number;
	document: SaveDocument;
	baseline: SaveDocument;
	// Computed while immutable branches are still shared, before public detachment.
	net: JsonPatch.JsonPatch;
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
// These patches are generated from validated SaveDocuments (or their exact
// inverses), not external patch requests. Keep the JSON/SaveDocument assertion
// at this one representation boundary; Effect's patch API forgets the root type.
const applyDocumentPatch = (
	patch: JsonPatch.JsonPatch,
	document: SaveDocument,
) => JsonPatch.apply(patch, json(document)) as unknown as SaveDocument;
const isDomainState = (value: unknown): value is DomainState =>
	value !== null &&
	typeof value === "object" &&
	!Array.isArray(value) &&
	Schema.is(Schema.Json)(value);

/** Bounds retained undo entries and serialized payload bytes, not total heap use. */
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

/**
 * Acquire authoritative document/history state in the enclosing Effect scope.
 * Prepared document, identity, domain-state and review changes commit atomically;
 * failed preparation publishes none of them. External side effects are not undone.
 *
 * Limits default to 100 entries and 8 MiB; the import baseline survives eviction.
 * Item handles are allocated only for supported, unambiguous backpack arrays;
 * unsupported inventories remain preserved and do not block other save edits.
 */
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
			return yield* new MutationError(
				"History limit must be a positive integer",
			);
		if (!Number.isSafeInteger(byteLimit) || byteLimit < 1)
			return yield* new MutationError(
				"History byte budget must be a positive safe integer",
			);
		if (!Schema.is(Schema.Json)(document))
			return yield* new MutationError("History requires plain JSON save data");
		const baseline = structuredClone(document);
		if (!isDomainState(initialDomainState))
			return yield* new MutationError("Domain state requires plain JSON data");
		// Item IDs describe types, not instances. Allocate session-only handles,
		// including opaque/empty slots, without adding fields to the exported save.
		let nextIdentity = 0;
		const identities: Record<string, string[]> = Object.create(null);
		const equipmentIdentities: EquipmentIdentities = Object.create(null);
		// Allocate handles only when ownership and slot order can be resolved safely.
		// Unsupported inventories and duplicate farmer IDs stay in the document,
		// but cannot prevent calendar/Farm edits or gain editable item handles.
		const inventoryFarmers = backpackFarmers(baseline);
		for (const farmer of inventoryFarmers) {
			// Opaque identifiers can contain non-callable conversion properties.
			// Validate their scalar shape before attempting string conversion.
			if (!hasBackpackFarmerId(farmer)) continue;
			const id = String(farmer.UniqueMultiplayerID);
			if (
				inventoryFarmers.filter(
					(other) =>
						hasBackpackFarmerId(other) &&
						String(other.UniqueMultiplayerID) === id,
				).length !== 1 ||
				!farmer.items ||
				!Array.isArray(farmer.items.Item)
			)
				continue;
			identities[id] = farmer.items.Item.map(() => `item:${++nextIdentity}`);
			// Equipment has stable field locations, including absent fields. Its handles
			// remain session-only; allocating them must not materialize empty XML nodes.
			equipmentIdentities[id] = Object.fromEntries(
				equipmentSlots.map((key) => [key, `item:${++nextIdentity}`]),
			) as Record<(typeof equipmentSlots)[number], string>;
		}
		// Virtual empty chest slots receive handles without materializing them in XML.
		for (const owner of inventoryContainers(baseline)) {
			if (owner.kind === "chest")
				identities[owner.id] = owner.slots.map(() => `item:${++nextIdentity}`);
		}
		const ref = yield* TxSubscriptionRef.make<History>({
			domainState: structuredClone(initialDomainState),
			retainedBytes: 0,
			nextIdentity,
			identities,
			equipmentIdentities,
			revision: 0,
			chestRevision: 0,
			document: baseline,
			net: [],
			baseline,
			entries: [],
			cursor: 0,
			nextId: 1,
			dropped: 0,
		});
		let closed = false;
		yield* Effect.addFinalizer(() =>
			Effect.gen(function* () {
				closed = true;
				// A retained gesture handle must not keep its start-document snapshot
				// alive after the file scope closes. Ordinary history is unaffected.
				yield* Effect.tx(
					TxSubscriptionRef.update(ref, (state) => {
						const { editGroup: _group, ...finished } = state;
						return finished;
					}),
				);
			}),
		);

		// Every entry, whether driven by legacy commands or a typed Effect program,
		// uses this one diff/budget/retention path. Annotation success alone cannot
		// create a history entry when document, provenance and identities did not change.
		const finish = (
			state: History,
			input: SessionState,
			identities: History["identities"],
			nextIdentity: number,
			resolved: readonly Mutation[],
			label?: string,
			annotations: readonly ReviewMetadata[] = [],
			equipmentIdentities: EquipmentIdentities = state.equipmentIdentities,
		): Result.Result<History, MutationError> => {
			let prepared = input;
			// Quiet children remain in annotations, but a standalone child should
			// supply the group heading rather than being drowned out by maintenance.
			const emphasized = annotations.filter(
				(value) => value.emphasis !== "compact",
			);
			const annotationLabel = (emphasized.length ? emphasized : annotations)
				.map((value) => value.label || "Unlabelled changes")
				.join("; ");
			// Adapters may retain their mutable drafts. Detach every changed value,
			// then replay onto our immutable document: unchanged branches remain
			// session-owned and shared with earlier revisions and the import baseline.
			// No draft object crosses this publication boundary by reference.
			const forward = structuredClone(
				JsonPatch.get(json(state.document), json(prepared.document)),
			);
			prepared = {
				document: applyDocumentPatch(forward, state.document),
				domainState: structuredClone(input.domainState ?? {}),
				history: structuredClone(input.history),
			};
			// Swapping byte-identical items still moves distinct session entities.
			// Keep that undoable even when the XML has no net difference.
			if (
				forward.length === 0 &&
				JsonPatch.get(json(state.domainState), json(prepared.domainState ?? {}))
					.length === 0 &&
				JSON.stringify(identities) === JSON.stringify(state.identities) &&
				JSON.stringify(equipmentIdentities) ===
					JSON.stringify(state.equipmentIdentities)
			)
				return Result.succeed(state);
			const receipts = prepared.history;
			const first = receipts[0] ?? {
				intent: resolved.find((action) => action.type === "reorder") ??
					resolved[0] ?? { type: "effect-transaction" },
				label: resolved.some((action) => action.type === "reorder")
					? "Reorder backpack"
					: "Unlabelled changes",
				review: "compact" as const,
			};
			const payload: Omit<Entry, "bytes"> = {
				domainBefore: state.domainState,
				domainAfter: prepared.domainState ?? {},
				equipmentBefore: state.equipmentIdentities,
				equipmentAfter: equipmentIdentities,
				identitiesBefore: state.identities,
				identitiesAfter: identities,
				id: state.nextId,
				actions: structuredClone(resolved),
				annotations: structuredClone(annotations),
				intent: {
					intent: structuredClone(first.intent),
					label:
						label ??
						(annotations.length ? annotationLabel : undefined) ??
						(receipts.length > 1
							? receipts
									.map((receipt) => receipt.label || "Unlabelled changes")
									.join("; ")
							: first.label),
					review: (
						annotations.length > 0
							? annotations.some((value) => value.emphasis !== "compact")
							: (receipts.length === 0 && forward.length > 0) ||
								receipts.some((receipt) => receipt.review === "standalone")
					)
						? "standalone"
						: "compact",
				},
				forward,
				backward: JsonPatch.get(json(prepared.document), json(state.document)),
			};
			const entry: Entry = { ...payload, bytes: entryBytes(payload) };
			// Reject one oversized operation before publishing anything. Silently
			// applying an action that cannot be undone would be misleading.
			if (entry.bytes > byteLimit)
				return Result.fail(
					new MutationError("This action exceeds the undo history byte budget"),
				);
			const entries = [...state.entries.slice(0, state.cursor), entry];
			let retainedBytes = entries.reduce(
				(total, entry) => total + entry.bytes,
				0,
			);
			let evict = 0;
			while (entries.length - evict > limit || retainedBytes > byteLimit) {
				const removed = entries[evict];
				if (!removed)
					throw new Error("History byte accounting exceeded its entries");
				retainedBytes -= removed.bytes;
				evict++;
			}
			return Result.succeed({
				...state,
				retainedBytes,
				domainState: prepared.domainState ?? {},
				identities,
				equipmentIdentities,
				nextIdentity,
				document: prepared.document,
				entries: entries.slice(evict),
				cursor: entries.length - evict,
				nextId: state.nextId + 1,
				dropped: state.dropped + evict,
			});
		};

		const finishEdit = (
			state: History,
			prepared: SessionState,
			annotations: readonly ReviewMetadata[],
			editKey?: string,
			identities = state.identities,
			nextIdentity = state.nextIdentity,
		): Result.Result<History, MutationError> => {
			// Compare against the latest commit once, then recover immutable sharing
			// before comparing with the gesture baseline. Otherwise each keystroke
			// walks the entire save again for the forward, inverse and net patches.
			const step = structuredClone(
				JsonPatch.get(json(state.document), json(prepared.document)),
			);
			prepared = {
				...prepared,
				document: applyDocumentPatch(step, state.document),
			};
			// A repeated valid value creates neither a revision nor a history step.
			if (
				step.length === 0 &&
				JsonPatch.get(json(state.domainState), json(prepared.domainState ?? {}))
					.length === 0
			)
				return Result.succeed(state);
			const { editGroup, ...ungrouped } = state;
			const before =
				editKey !== undefined && editGroup?.key === editKey
					? editGroup.before
					: ungrouped;
			const checked = finish(
				before,
				prepared,
				identities,
				nextIdentity,
				[],
				undefined,
				annotations,
			);
			if (Result.isFailure(checked)) return checked;
			const next = checked.success;
			// Recompute both patch directions against the first value, not by
			// appending inverse patches. Returning to that value removes the entry
			// and restores the pre-gesture redo tail without rolling back revisions.
			return Result.succeed(
				editKey === undefined
					? next
					: {
							...next,
							revision: state.revision,
							nextId: Math.max(next.nextId, state.nextId),
							editGroup: { key: editKey, before },
						},
			);
		};

		const update = <E = never, R = never>(
			change: (state: History) => History | Effect.Effect<History, E, R>,
			expectedRevision?: number,
			editKey?: string,
		) =>
			Effect.andThen(
				// A new field is a boundary even if its first value is rejected or
				// unchanged. Keep this outside the attempt so failure cannot reopen it.
				editKey === undefined
					? endEdit()
					: Effect.flatMap(TxSubscriptionRef.get(ref), (state) =>
							state.editGroup && state.editGroup.key !== editKey
								? endEdit()
								: Effect.void,
						),
				Effect.tx(
					Effect.gen(function* () {
						const current = yield* TxSubscriptionRef.get(ref);
						// The transaction may retry after another lower-level caller has
						// published a gesture since the outer boundary ran. Re-establish
						// that boundary against this attempt's actual state: otherwise a
						// later field write could reuse a baseline preceding this action.
						const { editGroup, ...withoutGroup } = current;
						const state =
							editKey !== undefined && editGroup?.key === editKey
								? current
								: editGroup
									? withoutGroup
									: current;
						if (closed) return yield* new MutationError("Session closed");
						// A stale draft must fail before its preparer can stage any writes.
						if (
							expectedRevision !== undefined &&
							state.revision !== expectedRevision
						)
							return yield* new MutationError(
								"The save changed while editing. Reload the current value.",
							);
						const proposed = change(state);
						const next = Effect.isEffect(proposed) ? yield* proposed : proposed;
						const published =
							next === state
								? state
								: {
										...next,
										revision: current.revision + 1,
										// Use actual committed inputs, not labels: compound/custom
										// operations and Undo may change any domain dependency.
										chestRevision: sameChestProjectionInputs(current, next)
											? current.chestRevision
											: current.chestRevision + 1,
										// Preserve review accuracy across eviction and Undo, without
										// repeating a full baseline diff on detached public documents.
										net: JsonPatch.get(
											json(next.baseline),
											json(next.document),
										),
									};
						// Clearing only grouping metadata does not advance the document
						// revision, but still needs publication into the authoritative ref.
						if (published !== current)
							yield* TxSubscriptionRef.set(ref, published);
						return detached(published);
					}),
				),
			);

		// Ending a gesture changes no saved value or revision. Commit it separately
		// so even a later rejected standalone action cannot reopen an older group.
		const endEdit = (key?: string) =>
			Effect.tx(
				Effect.gen(function* () {
					const state = yield* TxSubscriptionRef.get(ref);
					if (closed) return yield* new MutationError("Session closed");
					if (
						state.editGroup &&
						(key === undefined || state.editGroup.key === key)
					) {
						const { editGroup: _group, ...finished } = state;
						yield* TxSubscriptionRef.set(ref, finished);
					}
				}),
			);
		const detached = (state: History) => {
			const { editGroup: _group, ...visible } = state;
			return structuredClone(visible);
		};
		return {
			endEdit,
			snapshot: Effect.map(TxSubscriptionRef.get(ref), detached),
			// Group closure changes only private history metadata. Filter unchanged
			// revisions before detaching so blur never clones the entire save again.
			changes: Stream.unwrap(
				Effect.sync(() => {
					// Each subscription retains only a revision number. Retaining the last
					// History here would keep a closed gesture's baseline document alive.
					let revision: number | undefined;
					return TxSubscriptionRef.changesStream(ref).pipe(
						Stream.filter((state) => {
							if (state.revision === revision) return false;
							revision = state.revision;
							return true;
						}),
						Stream.map(detached),
					);
				}),
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
								inventory: structuredClone({
									identities: state.identities,
									equipmentIdentities: state.equipmentIdentities,
									nextIdentity: state.nextIdentity,
								}),
							};
							let identities = state.identities;
							let equipmentIdentities = state.equipmentIdentities;
							let nextIdentity = state.nextIdentity;
							const resolved: Mutation[] = [];
							for (const requested of structuredClone(actions)) {
								let action: Mutation = requested;
								// Backpack actions resolve their instances inside this queue turn.
								// A stale view cannot target a replacement by its old slot index.
								if (
									requested.type === "backpack-add" ||
									requested.type === "backpack-remove"
								) {
									action = yield* resolveBackpackLifecycle(
										prepared.document,
										identities,
										requested,
									);
								}
								if (requested.type === "backpack-move") {
									// Validate source and destination handles together before preparing
									// an atomic record/identity swap in this same queue turn.
									action = yield* resolveBackpackMove(
										prepared.document,
										identities,
										requested,
										equipmentIdentities,
									);
								}
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
										return yield* new MutationError(
											"Item no longer belongs to this farmer",
										);
									action = { ...requested, slot };
								}
								// Operations prepare records and session lifetimes together. History
								// validates publication data but never replays slot semantics.
								const previousDomain = prepared.domainState ?? {};
								const previousInventory = prepared.inventory;

								const result = yield* operations.prepare(prepared, action);
								if (
									!result.inventory &&
									previousInventory &&
									isInventoryMutation(action)
								)
									return yield* new MutationError(
										"Inventory adapters must prepare record and identity changes together",
									);
								prepared = {
									...result,
									domainState: result.domainState ?? previousDomain,
									inventory: result.inventory ?? previousInventory,
								};
								if (
									!Schema.is(Schema.Json)(prepared.document) ||
									!isDomainState(prepared.domainState)
								)
									return yield* new MutationError(
										"Prepared document and domain state require plain JSON data",
									);
								if (prepared.inventory) {
									identities = prepared.inventory.identities;
									equipmentIdentities = prepared.inventory.equipmentIdentities;
									nextIdentity = prepared.inventory.nextIdentity;
								}
								resolved.push(action);
							}
							return yield* Effect.fromResult(
								finish(
									state,
									prepared,
									identities,
									nextIdentity,
									resolved,
									label,
									[],
									equipmentIdentities,
								),
							);
						}),

					expectedRevision,
				),
			// Program error types are inferred locally, not enumerated centrally.
			// Allocate both draft and journal inside the transaction attempt so a
			// retry, interruption or failed child publishes no partial metadata.
			transact: <A, E, R>(
				program: Effect.Effect<
					A,
					E,
					R | TransactionDraft | ReviewJournal | BackpackItemEdits
				>,
				expectedRevision?: number,
				editKey?: string,
			) =>
				update(
					(state) =>
						Effect.gen(function* () {
							const draft = makeTransactionDraft({
								document: state.document,
								domainState: state.domainState,
								history: [],
							});
							const itemEdits = makeBackpackItemEdits(
								draft.service,
								state.identities,
								state.document,
								state.equipmentIdentities,
								state.nextIdentity,
							);
							const { collected, prepared, authorized, inventory } =
								yield* collectTransactionMetadata(program).pipe(
									Effect.provideService(TransactionDraft, draft.service),
									Effect.provideService(BackpackItemEdits, itemEdits.service),
									// Take the result before close clears retained service state.
									// Escaped capability handles must not retain an abandoned save.
									Effect.flatMap((collected) =>
										Effect.map(draft.prepared, (prepared) => ({
											collected,
											inventory: itemEdits.inventory(),
											prepared,
											// Validate while the attempt still owns its patch/read authority;
											// close then clears those retained values before publication.
											authorized: itemEdits.validate(
												prepared.document,
												state.document,
											),
										})),
									),
									Effect.ensuring(draft.close),
									Effect.ensuring(itemEdits.close),
								);
							// A prepared snapshot must match the exact approved inventory patches
							// and context reads captured before the attempt was closed.
							if (!authorized)
								return yield* new MutationError(
									"Inventory changes or game context did not match the supported item operation",
								);
							// Inventory capabilities return the same paired transition contract as
							// actions. History owns publication, never slot allocation/replay.

							return yield* Effect.fromResult(
								finishEdit(
									state,
									prepared,
									collected.records,
									editKey,
									inventory.identities,
									inventory.nextIdentity,
								),
							);
						}),
					expectedRevision,
					editKey,
				),
			undo: update((state) => {
				if (state.cursor === 0) return state;
				const entry = state.entries[state.cursor - 1];
				if (!entry) throw new Error("Undo cursor has no history entry");
				return {
					...state,
					identities: entry.identitiesBefore,
					equipmentIdentities: entry.equipmentBefore,
					domainState: entry.domainBefore,
					document: applyDocumentPatch(entry.backward, state.document),
					cursor: state.cursor - 1,
				};
			}),
			redo: update((state) => {
				if (state.cursor === state.entries.length) return state;
				const entry = state.entries[state.cursor];
				if (!entry) throw new Error("Redo cursor has no history entry");
				return {
					...state,
					identities: entry.identitiesAfter,
					equipmentIdentities: entry.equipmentAfter,
					domainState: entry.domainAfter,
					document: applyDocumentPatch(entry.forward, state.document),
					cursor: state.cursor + 1,
				};
			}),
			review: Effect.map(TxSubscriptionRef.get(ref), (state) =>
				structuredClone({
					// Original import survives history eviction, so export review remains complete.
					net: state.net,
					entries: state.entries.slice(0, state.cursor),
					dropped: state.dropped,
				}),
			),
		};
	});

// Application and comparison views share these session contracts.
export type HistorySession = Effect.Success<
	ReturnType<typeof makeHistorySession>
>;
export type HistoryState = Effect.Success<HistorySession["snapshot"]>;
