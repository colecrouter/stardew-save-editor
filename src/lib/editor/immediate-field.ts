import type { CommandResult } from "./command-result.ts";
import type { EditGesture } from "./edit-gesture.ts";

/** A snapshot of domain presentation plus captured commands, not a live save proxy.
 * Refresh descriptors from the domain view; scope/key identify their stable meaning.
 * Commit/end cross the file command boundary and resolve typed failures or null for
 * handled defects/cancellation rather than rejecting with expected errors.
 */
// Optional presentation members may be omitted or explicitly unavailable.
// These transient projections do not encode presence of serialized save fields.
export interface ImmediateField<T extends string | number | boolean> {
	// Scope is a stable, opaque session identity. Key identifies the target and
	// command meaning within it; new snapshots keep both identities unchanged.
	readonly scope: symbol;
	readonly key: string;
	readonly label: string;
	readonly value: T | undefined;
	readonly available: boolean;
	readonly reason?: string | undefined;
	readonly constraints?:
		| {
				readonly required?: boolean | undefined;
				readonly min?: number | undefined;
				readonly max?: number | undefined;
				readonly step?: number | "any" | undefined;
		  }
		| undefined;
	readonly options?:
		| readonly { readonly value: T; readonly label: string }[]
		| undefined;
	readonly begin: () => EditGesture;
	readonly commit: (
		value: T,
		gesture: EditGesture,
	) => Promise<CommandResult<unknown, { readonly message: string }>>;
	readonly end: (
		gesture: EditGesture,
	) => Promise<CommandResult<unknown, { readonly message: string }>>;
}
