import { Cause, Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Readable } from "svelte/store";
import type { Mutation } from "./domain.ts";
import {
	type HistorySession,
	type InventoryModel,
	inventory,
	sameView,
	stackAction,
	makeStackField,
} from "./inventory-model.ts";

export const makeAtomInventory = (session: HistorySession) =>
	Effect.gen(function* () {
		// UI callbacks run later; retain the session services at this boundary.
		const services = yield* Effect.context<never>();
		const registry = yield* Effect.acquireRelease(
			// Supplying a zero TTL without a positive bucket resolution produces a
			// NaN timer in Effect 4.0.6. Keep eviction immediate with a valid bucket.
			Effect.sync(() =>
				AtomRegistry.make({ defaultIdleTTL: 0, timeoutResolution: 1 }),
			),
			(registry) => Effect.sync(() => registry.dispose()),
		);
		const initial = yield* session.snapshot;
		let liveStreams = 0;
		const observed = Stream.unwrap(
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
		const source = Atom.make(observed);
		const state = Atom.make((get) =>
			// An evicted view may remount after edits elsewhere. Read the current
			// session while its stream reconnects, never the model's original snapshot.
			AsyncResult.getOrElse(get(source), () =>
				Effect.runSyncWith(services)(session.snapshot),
			),
		);
		const farmer = Atom.make(
			String(initial.document.SaveGame.player.UniqueMultiplayerID),
		);
		const slot = Atom.make(0);
		const items = Atom.make((get) => inventory(get(state), get(farmer))).pipe(
			Atom.withEquality(sameView),
		);
		const selected = Atom.make((get) => get(items)[get(slot)]).pipe(
			Atom.withEquality(sameView),
		);
		const money = Atom.make((get) => {
			const current = get(state).document.SaveGame;
			return (
				[
					current.player,
					...(current.farmhands === "" ? [] : current.farmhands.Farmer),
				].find((player) => String(player.UniqueMultiplayerID) === get(farmer))
					?.money ?? 0
			);
		});
		const canUndo = Atom.make((get) => get(state).cursor > 0);
		const canRedo = Atom.make(
			(get) => get(state).cursor < get(state).entries.length,
		);
		const count = Atom.make((get) => get(state).cursor);
		// Capture target at the write boundary; selection changes cannot retarget an
		// asynchronous action. Concurrent actions still commit via the history service.
		type Command =
			| { type: "mutate"; actions: Mutation[] }
			| { type: "undo" | "redo" };
		const command = Atom.fn(
			(input: Command) =>
				(input.type === "mutate"
					? session.execute(input.actions)
					: input.type === "undo"
						? session.undo
						: session.redo
				).pipe(Effect.asVoid),
			{ concurrent: true },
		);
		const error = Atom.make((get) => {
			const result = get(command);
			if (AsyncResult.isFailure(result)) return Cause.pretty(result.cause);
			return "";
		});
		const stack = Atom.writable(
			(get) => get(selected)?.stack ?? 0,
			(ctx, value: number) =>
				ctx.set(command, {
					type: "mutate",
					actions: [stackAction(ctx.get(farmer), ctx.get(selected), value)],
				}),
		);
		// Store adapters are read-only even for atom-backed fields. Writes use only
		// explicit field/command APIs; the document/source atom is never exported.
		const read = <A>(atom: Atom.Atom<A>): Readable<A> => ({
			subscribe: (notify) =>
				registry.subscribe(atom, notify, { immediate: true }),
		});
		return {
			historyUsage: read(
				Atom.make((get) => ({
					bytes: get(state).retainedBytes,
					dropped: get(state).dropped,
				})).pipe(Atom.withEquality(sameView)),
			),
			kind: "atom",
			stackField: makeStackField(
				session,
				read(state),
				read(farmer),
				read(slot),
				services,
			),
			items: read(items),
			selected: read(selected),
			money: read(money),
			canUndo: read(canUndo),
			canRedo: read(canRedo),
			count: read(count),
			error: read(error),
			stack: { ...read(stack), set: (value) => registry.set(stack, value) },
			chooseSlot: (value) => registry.set(slot, value),
			chooseFarmer: (id) => {
				registry.set(farmer, id);
				registry.set(slot, 0);
			},
			undo: () => registry.set(command, { type: "undo" }),
			redo: () => registry.set(command, { type: "redo" }),
			reverse: () =>
				registry.set(command, {
					type: "mutate",
					actions: [
						{
							type: "reorder",
							farmerId: registry.get(farmer),
							order: registry
								.get(items)
								.map((_, index, all) => all.length - index - 1),
						},
					],
				}),
			debug: () => ({ nodes: registry.getNodes().size, liveStreams }),
		} satisfies InventoryModel;
	});
