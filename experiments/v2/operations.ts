import { Context, Effect } from "effect";
import {
	MutationError,
	prepare,
	type Mutation,
	type SessionState,
} from "./domain.ts";

export interface Operations {
	prepare: (
		state: SessionState,
		action: Mutation,
	) => Effect.Effect<SessionState, MutationError>;
}

// The session captures an adapter at construction. Its operation definitions own
// game-format behavior; views receive operation handles, never this draft API.
export class EditorOperations extends Context.Service<
	EditorOperations,
	Operations
>()("v2/EditorOperations") {}

export const coreOperations: Operations = {
	prepare: (state, action) =>
		Effect.try({
			try: () => prepare(state, action),
			catch: (error) =>
				error instanceof MutationError
					? error
					: new MutationError(String(error)),
		}),
};
