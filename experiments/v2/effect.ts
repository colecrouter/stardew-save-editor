import { Effect, Fiber, Stream, SubscriptionRef } from "effect";
import {
	type ResolvedMutation,
	MutationError,
	prepare,
	type SaveDocument,
	type SessionState,
} from "./domain.ts";

export const makeEffectSession = (document: SaveDocument) =>
	Effect.gen(function* () {
		// UI callbacks run later; retain the session services at this boundary.
		const services = yield* Effect.context<never>();
		const state = yield* SubscriptionRef.make<SessionState>({
			document: structuredClone(document),
			history: [],
		});
		let closed = false;
		const scope = yield* Effect.scope;
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				closed = true;
			}),
		);
		return {
			// Svelte can consume a store subscribing to this stream. Keep the ref
			// private: no writable UI replica or public set bypassing mutations.
			changes: Stream.map(SubscriptionRef.changes(state), (value) =>
				structuredClone(value),
			),
			// Minimal Svelte store contract: synchronous initial value, subsequent
			// read-only snapshots, unsubscribe. Each consumer fiber also belongs to
			// the session scope, so forgetting unsubscribe cannot outlive the session.
			subscribe: (notify: (value: SessionState) => void) => {
				if (closed) throw new MutationError("Session closed");
				notify(
					structuredClone(
						Effect.runSyncWith(services)(SubscriptionRef.get(state)),
					),
				);
				const fiber = Effect.runSyncWith(services)(
					Effect.forkIn(
						Stream.runForEach(SubscriptionRef.changes(state), (value) =>
							Effect.sync(() => notify(structuredClone(value))),
						),
						scope,
					),
				);
				return () => {
					Effect.runForkWith(services)(Fiber.interrupt(fiber));
				};
			},
			snapshot: Effect.map(SubscriptionRef.get(state), (value) =>
				structuredClone(value),
			),
			execute: (
				mutation: ResolvedMutation,
				inspect?: (draft: SaveDocument) => void,
			) =>
				SubscriptionRef.modifyEffect(state, (current) =>
					Effect.try({
						try: () => {
							if (closed) throw new MutationError("Session closed");
							const next = prepare(current, mutation, inspect);
							return [structuredClone(next), next] as const;
						},
						catch: (error) =>
							error instanceof MutationError
								? error
								: new MutationError(String(error)),
					}),
				),
		};
	});
