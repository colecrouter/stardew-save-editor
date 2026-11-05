import { Cause, Data, Effect, Exit, Result } from "effect";
import type { CommandResult } from "./command-result.ts";

/** A denied or unavailable clipboard leaves the selectable path usable by hand. */
export class ClipboardUnavailable extends Data.TaggedError(
	"ClipboardUnavailable",
)<{
	readonly message: string;
}> {}
const clipboardFailure = () =>
	new ClipboardUnavailable({
		message: "The path could not be copied. Select it and copy it manually.",
	});

/** Copy only: choosing a save remains an explicit, separately labelled action. */
export const copySaveLocation = Effect.fn("Entry.copySaveLocation")(function* (
	path: string,
) {
	if (!navigator.clipboard?.writeText) return yield* clipboardFailure();
	// A browser denial is expected feedback. A programming error remains a defect
	// for the entry runtime, rather than silently pretending copying was denied.
	yield* Effect.promise(() => navigator.clipboard.writeText(path)).pipe(
		Effect.catchDefect((cause) =>
			cause instanceof DOMException ||
			Object.prototype.toString.call(cause) === "[object DOMException]"
				? Effect.fail(clipboardFailure())
				: Effect.die(cause),
		),
	);
});

/** Run upload-screen actions without letting a UI event own unhandled failures. */
export async function runEntryCommand<A, E>(
	program: Effect.Effect<A, E>,
	reportDefect: (message: string) => void,
	failure: { readonly context: string; readonly message: string },
): Promise<CommandResult<A, E>> {
	const exit = await Effect.runPromiseExit(program);
	if (Exit.isSuccess(exit)) return Result.succeed(exit.value);
	if (!Cause.hasDies(exit.cause) && !Cause.hasInterrupts(exit.cause)) {
		const expected = Cause.findError(exit.cause);
		if (Result.isSuccess(expected)) return Result.fail(expected.success);
	}
	// Interrupted owners have no surviving surface to notify; unexpected defects
	// report once at the shared boundary, leaving independent entry actions usable.
	if (!Cause.hasInterruptsOnly(exit.cause)) {
		console.error(
			`V2 ${failure.context} command defect`,
			Cause.pretty(exit.cause),
		);
		reportDefect(failure.message);
	}
	return null;
}
