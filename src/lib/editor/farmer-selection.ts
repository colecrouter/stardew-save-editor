import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";

/** Domain selection candidates expose identity and display text, never raw farmer records. */
export interface FarmerChoice {
	readonly farmerId: string;
	readonly name: string;
}

/**
 * Adapt session-owned selection to the same fallible field boundary as saved
 * values. Selecting a farmer never creates an Undo entry, but it still needs
 * queued validation, expected-error feedback, and controlled-value rollback.
 */
export function createFarmerSelectionField(
	farmers: readonly FarmerChoice[],
	selectedId: string | undefined,
	model: EditorModel,
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
