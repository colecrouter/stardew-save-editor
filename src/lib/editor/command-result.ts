import type { Result } from "effect";

/**
 * Success or an expected typed failure from a session-owned command.
 * `null` means the application handled noncompletion (defect or cancellation);
 * feature UIs must not show success or duplicate defect reporting in that case.
 */
export type CommandResult<A, E> = Result.Result<A, E> | null;
