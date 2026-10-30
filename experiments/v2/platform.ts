import { Effect, FileSystem } from "effect";
import type { ResolvedMutation } from "./domain.ts";
import { makeEffectSession } from "./effect.ts";
import { SaveCodec } from "./save-service.ts";

// The domain program asks for abstract filesystem and codec services. Node layers
// are assembled by the CLI/tests; a browser would instead supply File/worker ports.
export const editFile = (input: string, actions: readonly ResolvedMutation[]) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const codec = yield* SaveCodec;
		const bytes = yield* fs.readFile(input);
		const document = yield* codec.decode(bytes);
		const session = yield* makeEffectSession(document);
		for (const action of actions) yield* session.execute(action);
		const state = yield* session.snapshot;
		const exported = yield* codec.encode(state.document);
		// Verify readability before making bytes available for writing. This is not a
		// claim of full in-game validation.
		yield* codec.decode(exported);
		return { exported, history: state.history };
	});
