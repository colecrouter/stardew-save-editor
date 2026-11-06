import { bindImmediateField, type ImmediateEditPort } from "./field-binding.ts";
import type { PetView } from "./pet-data.ts";
import { setPet } from "./pet-operations.ts";
import { petAppearances } from "./pet-appearance.ts";

/** Each control captures the pet GUID, so renaming or navigating cannot retarget
 * queued input. Shared field controllers own blur grouping and error feedback. */
export function createPetFields(view: PetView, model: ImmediateEditPort) {
	const options = petAppearances.map(({ value, label }) => ({ value, label }));
	// A custom pair is a retained current value, not a supported destination.
	// Selecting one of the vanilla pairs is the explicit intent to replace it.
	if (view.appearance.value && !view.appearance.known)
		options.unshift({
			value: view.appearance.value,
			label: `Custom (${view.type} — breed ${view.breed})`,
		});
	if (!view.appearance.value)
		options.unshift({ value: "", label: "Unreadable saved appearance" });
	return {
		appearance: bindImmediateField(
			model,
			{
				key: `pet:${view.key}:appearance`,
				label: "Appearance",
				value: view.appearance.value ?? "",
				available: view.appearance.available,
				reason: view.appearance.reason,
				options,
			},
			(value: string) => {
				// Look up opaque selector values rather than trusting JSON from the UI.
				// The operation independently validates the destination before writing.
				const choice = petAppearances.find((entry) => entry.value === value);
				return setPet({
					petId: view.id ?? "",
					kind: "appearance",
					value: {
						petType: choice?.petType ?? "",
						breedId: choice?.breedId ?? "",
					},
				});
			},
		),
		name: bindImmediateField(
			model,
			{
				key: `pet:${view.key}:name`,
				label: "Name",
				value: view.name,
				available: view.supported && view.nameEditable,
				reason:
					view.reason ??
					(!view.nameEditable ? "The saved name is unsupported." : undefined),
				constraints: { required: true },
			},
			(value: string) => setPet({ petId: view.id ?? "", kind: "name", value }),
		),
		friendship: bindImmediateField(
			model,
			{
				key: `pet:${view.key}:friendship`,
				label: "Friendship",
				value: view.friendship,
				available: view.supported && view.friendship !== undefined,
				reason:
					view.reason ??
					(view.friendship === undefined
						? "The saved friendship is unsupported."
						: undefined),
				constraints: { min: 0, max: 1000, step: 1 },
			},
			(value: number) =>
				setPet({ petId: view.id ?? "", kind: "friendship", value }),
		),
	};
}
