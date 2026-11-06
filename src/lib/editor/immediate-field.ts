import type { CommandResult } from "./command-result.ts";
import type { EditGesture } from "./edit-gesture.ts";

/** A snapshot of domain presentation plus captured commands, not a live save proxy.
 * Refresh descriptors from the domain view; scope/key identify their stable meaning.
 * Commit/end cross the file command boundary and resolve typed failures or null for
 * handled defects/cancellation rather than rejecting with expected errors.
 */
export interface ImmediateField<T extends string | number | boolean> {
	// Scope is a stable, opaque session identity. Key identifies the target and
	// command meaning within it; new snapshots keep both identities unchanged.
	readonly scope: symbol;
	readonly key: string;
	readonly label: string;
	readonly value: T | undefined;
	readonly available: boolean;
	readonly reason?: string;
	readonly constraints?: {
		readonly required?: boolean;
		readonly min?: number;
		readonly max?: number;
		readonly step?: number | "any";
	};
	readonly options?: readonly { readonly value: T; readonly label: string }[];
	readonly begin: () => EditGesture;
	readonly commit: (
		value: T,
		gesture: EditGesture,
	) => Promise<CommandResult<unknown, { readonly message: string }>>;
	readonly end: (
		gesture: EditGesture,
	) => Promise<CommandResult<unknown, { readonly message: string }>>;
}
