import type { Result } from "effect";

// null means the application handled an unsuccessful execution (defect or
// cancellation). Features only branch on completion and expected typed failures.
export type CommandResult<A, E> = Result.Result<A, E> | null;
