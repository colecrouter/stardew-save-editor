import type { ImmutableView } from "./immutable-view.ts";
import { bindImmediateField, type ImmediateEditPort } from "./field-binding.ts";
import type { ImmediateField } from "./immediate-field.ts";
import {
	setCharacterDetails,
	type CharacterDetailsView,
} from "./character-details.ts";
/** Capture the farmer selected when descriptors were built, including queued work. */
export function createCharacterDetailsDomain(
	view: ImmutableView<CharacterDetailsView>,
	farmerId: string,
	model: ImmediateEditPort,
) {
	function field<T extends number | boolean | string>(
		key: string,
		label: string,
		value: T | undefined,
		available: boolean,
		reason?: string,
		constraints?: ImmediateField<T>["constraints"],
	): ImmediateField<T> {
		const identity = `character-details:${JSON.stringify([key === "hay" || key === "walnuts" || key === "mine" ? "shared" : farmerId, key])}`;
		return bindImmediateField(
			model,
			{ key: identity, label, value, available, constraints, reason },
			(value: T) => setCharacterDetails({ farmerId, key, value }),
		);
	}
	return {
		...view,
		numbers: view.numbers.map((entry) =>
			field(
				entry.key,
				entry.label,
				entry.value,
				entry.available,
				entry.reason,
				{ min: entry.min, max: entry.max, step: 1 },
			),
		),
		wallet: view.wallet.map((entry) =>
			field(entry.key, entry.label, entry.value, entry.available, entry.reason),
		),
		backpack: {
			...field<string>(
				"backpack",
				"Backpack capacity",
				view.backpackSize === undefined ? undefined : String(view.backpackSize),
				view.backpackAvailable,
				view.backpackAvailable
					? undefined
					: "This backpack has an unsupported saved capacity.",
			),
			options: [12, 24, 36].map((size) => ({
				value: String(size),
				label: `${size} slots`,
			})),
		},
		cancelHouse: field<boolean>(
			"house-cancel",
			"Cancel house upgrade",
			false,
			view.houseUpgrading,
		),
	};
}
