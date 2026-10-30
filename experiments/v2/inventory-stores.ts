import { Cause, Effect, Fiber, Stream } from "effect";
import { derived, get, type Readable, readable, writable } from "svelte/store";
import { farmers } from "./domain.ts";
import {
	type HistorySession,
	type InventoryModel,
	inventory,
	sameView,
	stackAction,
	makeStackField,
} from "./inventory-model.ts";

export const makeStoreInventory = (session: HistorySession) =>
	Effect.gen(function* () {
		// UI callbacks run later; retain the session services at this boundary.
		const services = yield* Effect.context<never>();
		const scope = yield* Effect.scope;
		const initial = yield* session.snapshot;
		let liveStreams = 0;
		const state = readable(initial, (set) => {
			set(Effect.runSyncWith(services)(session.snapshot));
			const stream = Stream.unwrap(
				Effect.gen(function* () {
					yield* Effect.acquireRelease(
						Effect.sync(() => {
							liveStreams++;
						}),
						() =>
							Effect.sync(() => {
								liveStreams--;
							}),
					);
					return session.changes;
				}),
			);
			const fiber = Effect.runSyncWith(services)(
				Effect.forkIn(
					Stream.runForEach(stream, (value) => Effect.sync(() => set(value))),
					scope,
				),
			);
			return () => {
				Effect.runForkWith(services)(Fiber.interrupt(fiber));
			};
		});
		const farmer = writable(
			String(initial.document.SaveGame.player.UniqueMultiplayerID),
		);
		const slot = writable(0);
		const items = derived([state, farmer], ([state, id]) =>
			inventory(state, id),
		);
		const selected = derived([items, slot], ([items, slot]) => items[slot]);
		const money = derived(
			[state, farmer],
			([state, id]) =>
				farmers(state.document).find(
					(player) => String(player.UniqueMultiplayerID) === id,
				)?.money ?? 0,
		);
		const error = writable("");
		const run = <A>(action: Effect.Effect<A, unknown>) => {
			error.set("");
			Effect.runForkWith(services)(
				Effect.forkIn(
					action.pipe(
						Effect.catchCause((cause) =>
							Effect.sync(() => error.set(Cause.pretty(cause))),
						),
					),
					scope,
				),
			);
		};
		// Svelte derived stores notify object subscribers even when the selected data
		// is unchanged. Match Atom's comparator explicitly for an equivalent comparison.
		const distinct = <A>(source: Readable<A>): Readable<A> => ({
			subscribe: (notify) => {
				let first = true;
				let previous: A;
				return source.subscribe((value) => {
					if (first || !sameView(value, previous)) {
						first = false;
						previous = value;
						notify(value);
					}
				});
			},
		});
		return {
			historyUsage: derived(state, (state) => ({
				bytes: state.retainedBytes,
				dropped: state.dropped,
			})),
			kind: "store",
			stackField: makeStackField(session, state, farmer, slot, services),
			items: distinct(items),
			selected: distinct(selected),
			money,
			canUndo: derived(state, (state) => state.cursor > 0),
			canRedo: derived(state, (state) => state.cursor < state.entries.length),
			count: derived(state, (state) => state.cursor),
			error,
			stack: {
				...derived(selected, (item) => item?.stack ?? 0),
				set: (value) =>
					run(
						session.execute([stackAction(get(farmer), get(selected), value)]),
					),
			},
			chooseSlot: (value) => slot.set(value),
			chooseFarmer: (id) => {
				farmer.set(id);
				slot.set(0);
			},
			undo: () => run(session.undo),
			redo: () => run(session.redo),
			reverse: () =>
				run(
					session.execute([
						{
							type: "reorder",
							ownerId: get(farmer),
							order: get(items).map((_, index, all) => all.length - index - 1),
						},
					]),
				),
			debug: () => ({ nodes: 0, liveStreams }),
		} satisfies InventoryModel;
	});
