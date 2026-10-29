import { farmProfitLimits } from "./farm-settings.ts";
import { bindImmediateField, type ImmediateEditPort } from "./field-binding.ts";
import type { ImmediateField } from "./immediate-field.ts";
import { setFarmSettings, type FarmView } from "./farm-operations.ts";

/** Domain field handles keep shared farm copies and transaction construction out of controls. */
export function createFarmFields(view: FarmView, model: ImmediateEditPort) {
	function field<
		K extends "name" | "profitPercent" | "monsters" | "mineRewards",
	>(
		property: K,
		label: string,
		constraints?: ImmediateField<FarmView[K]>["constraints"],
	): ImmediateField<FarmView[K]> {
		const key = `farm:${property}`;
		return bindImmediateField(
			model,
			{ key, label, value: view[property], available: true, constraints },
			(value: FarmView[K]) => setFarmSettings({ [property]: value }),
		);
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
		profitPercent: field(
			"profitPercent",
			"Profit margin (%)",
			farmProfitLimits,
		),
		monsters: field("monsters", "Spawn monsters on the farm"),
		mineRewards: { ...mineRewards, options: choices },
	};
}
