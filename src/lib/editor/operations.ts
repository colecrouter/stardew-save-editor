import { prepareBundleOperation } from "./bundle-operations.ts";
import { Context, Effect } from "effect";
import { prepareCalendarOperation } from "./calendar-operations.ts";
import {
	type MutationError,
	prepareEffect,
	type ResolvedMutation,
	type SessionState,
} from "./domain.ts";

export interface Operations {
	prepare: (
		state: SessionState,
		action: ResolvedMutation,
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
		action.type === "bundle-complete"
			? prepareBundleOperation(state, action)
			: action.type === "calendar-date" || action.type === "calendar-weather"
				? prepareCalendarOperation(state, action)
				: prepareEffect(state, action),
};
