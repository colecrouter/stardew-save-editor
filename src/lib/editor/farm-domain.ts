import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";
import { setFarmSettings, type FarmView } from "./farm-operations.ts";

/** Domain field handles keep shared farm copies and transaction construction out of controls. */
export function createFarmFields(view: FarmView, model: EditorModel) {
	function field<
		K extends "name" | "profitPercent" | "monsters" | "mineRewards",
	>(
		property: K,
		label: string,
		constraints?: ImmediateField<FarmView[K]>["constraints"],
	): ImmediateField<FarmView[K]> {
		const key = `farm:${property}`;
		return {
			scope: model.edits.scope,
			key,
			label,
			value: view[property],
			available: true,
			constraints,
			begin: () => model.edits.begin(key),
			commit: (value, gesture) =>
				model.commands.edit(setFarmSettings({ [property]: value }), gesture),
			end: (gesture) => model.edits.end(gesture),
		};
	}
	const mineRewards = field("mineRewards", "Mine rewards");
	const choices = [
		{ value: "Default", label: "Normal" },
		{ value: "Remixed", label: "Remixed" },
	];
	// An imported custom mode stays visible until the user explicitly replaces it.
	if (!choices.some((choice) => choice.value === view.mineRewards))
		choices.unshift({
			value: view.mineRewards,
			label: `Custom (${view.mineRewards})`,
		});
	return {
		name: field("name", "Farm name", { required: true }),
		profitPercent: field("profitPercent", "Profit margin (%)", {
			min: 1,
			max: 1000,
			step: "any",
		}),
		monsters: field("monsters", "Spawn monsters on the farm"),
		mineRewards: { ...mineRewards, options: choices },
	};
}
