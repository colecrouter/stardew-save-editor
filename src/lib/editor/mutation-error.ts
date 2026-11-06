import { Data } from "effect";

/** Expected operation rejection, usable directly in Effect generators and pure planners. */
export class MutationError extends Data.TaggedError("MutationError")<{
	readonly message: string;
}> {
	constructor(message: string) {
		// A message-string constructor preserves existing domain rejection call sites.
		super({ message });
	}
}
