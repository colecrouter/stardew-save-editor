import {
	type ResolvedMutation,
	MutationError,
	prepare,
	type SaveDocument,
	type SessionState,
} from "./domain.ts";

export class PlainSession {
	#state: SessionState;
	#closed = false;
	constructor(document: SaveDocument) {
		this.#state = { document: structuredClone(document), history: [] };
	}
	snapshot() {
		return structuredClone(this.#state);
	}
	execute(mutation: ResolvedMutation, inspect?: (draft: SaveDocument) => void) {
		if (this.#closed) throw new MutationError("Session closed");
		this.#state = prepare(this.#state, mutation, inspect);
		return this.snapshot();
	}
	close() {
		this.#closed = true;
	}
}
