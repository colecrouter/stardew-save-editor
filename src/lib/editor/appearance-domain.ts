import type { ImmutableView } from "./immutable-view.ts";
import { bindImmediateField, type ImmediateEditPort } from "./field-binding.ts";
import type { ImmediateField } from "./immediate-field.ts";
import { createFarmFields } from "./farm-domain.ts";
import type { FarmView } from "./farm-operations.ts";
import {
	setAppearance,
	type AppearanceChange,
	type AppearanceView,
} from "./appearance-operations.ts";

/** Bind editor-owned fields to the farmer captured when this view was projected. */
export function createAppearanceDomain(
	view: ImmutableView<AppearanceView>,
	farm: ImmutableView<FarmView>,
	model: ImmediateEditPort,
) {
	function field<T extends string | number>(
		key: string,
		label: string,
		value: T | undefined,
		available: boolean,
		change: (value: T) => AppearanceChange,
		constraints?: ImmediateField<T>["constraints"],
		reason?: string,
	): ImmediateField<T> {
		const identity = `appearance:${JSON.stringify([view.farmerId, key])}`;
		return bindImmediateField(
			model,
			{ key: identity, label, value, available, reason, constraints },
			(value: T) => setAppearance(change(value)),
		);
	}
	return {
		...view,
		name: field(
			"name",
			"Name",
			view.texts.name.value,
			view.texts.name.available,
			(value) => ({ farmerId: view.farmerId, kind: "name", value }),
			{ required: true },
			view.texts.name.reason,
		),
		favorite: field(
			"favorite",
			"Favorite thing",
			view.texts.favorite.value,
			view.texts.favorite.available,
			(value) => ({ farmerId: view.farmerId, kind: "favorite", value }),
			undefined,
			view.texts.favorite.reason,
		),
		// Farm name is shared across saved farmers and uses the same gesture identity
		// as Farm settings rather than introducing a conflicting per-farmer setter.
		farmName: createFarmFields(farm, model).name,
		gender: {
			...field(
				"gender",
				"Gender",
				view.gender.value,
				view.gender.available,
				(value) => ({ farmerId: view.farmerId, kind: "gender", value }),
				undefined,
				view.gender.reason,
			),
			options: [
				{ value: "Male", label: "Male" },
				{ value: "Female", label: "Female" },
			],
		},
		numbers: view.numbers.map((number) =>
			field(
				number.key,
				number.label,
				number.value,
				number.available,
				(value) => ({ farmerId: view.farmerId, kind: number.key, value }),
				{ min: number.min, max: number.max, step: 1 },
				number.reason,
			),
		),
		colors: view.colors.map((color) =>
			field(
				color.key,
				color.label,
				color.value,
				color.available,
				(value) => ({ farmerId: view.farmerId, kind: color.key, value }),
				undefined,
				color.reason,
			),
		),
	};
}
