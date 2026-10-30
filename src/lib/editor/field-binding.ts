import type { Effect } from "effect";
import type { MutationError } from "./mutation-error.ts";
import type { CommandResult } from "./command-result.ts";
import type { EditGesture } from "./edit-gesture.ts";
import type { ImmediateField } from "./immediate-field.ts";
import type { TransactionDraft } from "./transaction-draft.ts";
import type { ReviewJournal } from "./transaction-annotations.ts";
import type { InventoryEdits } from "./inventory-operations.ts";

type EditServices = TransactionDraft | ReviewJournal | InventoryEdits;
/** Domain fields need only an editing capability, never the full editor model. */
export interface ImmediateEditPort {
	readonly edits: {
		readonly scope: symbol;
		begin: (key: string) => EditGesture;
		end: (
			gesture: EditGesture,
		) => Promise<CommandResult<unknown, MutationError>>;
	};
	readonly commands: {
		edit: <E>(
			program: Effect.Effect<unknown, E, EditServices>,
			gesture: EditGesture,
		) => Promise<CommandResult<unknown, E | MutationError>>;
	};
}
/** Discrete domain actions share the same narrow queue boundary as fields. */
export interface DomainEditPort extends ImmediateEditPort {
	readonly commands: ImmediateEditPort["commands"] & {
		transact: <A, E>(
			program: Effect.Effect<A, E, EditServices>,
			expectedRevision?: number,
		) => Promise<CommandResult<A, E | MutationError>>;
	};
}
type Presentation<T extends string | number | boolean> = Omit<
	ImmediateField<T>,
	"scope" | "begin" | "commit" | "end"
>;
/** Bind one snapshot to a captured operation. Stable scope/key ownership and
 * gesture lifecycle are shared; validation and coordinated writes stay domain-owned. */
export function bindImmediateField<
	T extends string | number | boolean,
	E extends { readonly message: string },
>(
	port: ImmediateEditPort,
	presentation: Presentation<T>,
	change: (value: T) => Effect.Effect<unknown, E, EditServices>,
): ImmediateField<T> {
	return {
		...presentation,
		scope: port.edits.scope,
		begin: () => port.edits.begin(presentation.key),
		commit: (value, gesture) => port.commands.edit(change(value), gesture),
		end: (gesture) => port.edits.end(gesture),
	};
}
