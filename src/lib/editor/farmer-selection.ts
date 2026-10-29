import { farmers, type SaveDocument } from "./domain.ts";
import type { ImmediateEditPort } from "./field-binding.ts";
import type { CommandResult } from "./command-result.ts";
import type { MutationError } from "./mutation-error.ts";
import type { ImmediateField } from "./immediate-field.ts";

/** Domain selection candidates expose identity and display text, never raw farmer records. */
export interface FarmerChoice {
	readonly farmerId: string;
	readonly name: string;
}

/** Shared identity projection; selection is independent of any feature's fields. */
export function readFarmerChoices(
	document: SaveDocument,
): (FarmerChoice & { readonly supported: boolean })[] {
	// Imported IDs may be numeric or textual. Other shapes remain visible as
	// unavailable choices rather than coupling selection to a feature decoder.
	const values = farmers(document).map((farmer) => {
		const key = farmer?.UniqueMultiplayerID;
		const farmerId =
			typeof key === "string"
				? key
				: typeof key === "number" && Number.isFinite(key)
					? String(key)
					: "";
		return {
			farmerId,
			name: typeof farmer?.name === "string" ? farmer.name : "Unnamed farmer",
		};
	});
	// A command must resolve exactly one owner; duplicate IDs cannot be selected.
	const counts = new Map<string, number>();
	for (const value of values)
		counts.set(value.farmerId, (counts.get(value.farmerId) ?? 0) + 1);
	return values.map((value) => ({
		...value,
		supported: value.farmerId !== "" && counts.get(value.farmerId) === 1,
	}));
}

/** Selection needs only its file scope and queued selection command. */
interface FarmerSelectionPort {
	readonly edits: ImmediateEditPort["edits"];
	readonly commands: {
		selectFarmer: (
			id: string,
		) => Promise<CommandResult<unknown, MutationError>>;
	};
}

/**
 * Adapt session-owned selection to the same fallible field boundary as saved
 * values. Selecting a farmer never creates an Undo entry, but it still needs
 * queued validation, expected-error feedback, and controlled-value rollback.
 */
export function createFarmerSelectionField(
	farmers: readonly FarmerChoice[],
	selectedId: string | undefined,
	model: FarmerSelectionPort,
): ImmediateField<string> {
	const counts = new Map<string, number>();
	for (const farmer of farmers)
		counts.set(farmer.farmerId, (counts.get(farmer.farmerId) ?? 0) + 1);
	// Every feature may have other unsupported fields. Selection depends only on
	// a nonempty, unique identity; malformed backpacks must not hide valid farmers.
	const options = farmers
		.filter(
			(farmer) => farmer.farmerId !== "" && counts.get(farmer.farmerId) === 1,
		)
		.map((farmer) => ({ value: farmer.farmerId, label: farmer.name }));
	const key = "session:farmer-selection";
	return {
		scope: model.edits.scope,
		key,
		label: "Farmer",
		value: selectedId,
		available: options.length > 0,
		options,
		...(options.length !== farmers.length
			? {
					reason:
						"Farmers with missing or ambiguous identities cannot be selected.",
				}
			: {}),
		begin: () => model.edits.begin(key),
		// The command rechecks the authoritative save, so a stale option rejects
		// without showing a new owner while its content still belongs to the old one.
		commit: (id) => model.commands.selectFarmer(id),
		end: (gesture) => model.edits.end(gesture),
	};
}
