import { MAX_YEAR } from "../calendar.ts";
import type { ImmutableView } from "./immutable-view.ts";
import { bindImmediateField, type DomainEditPort } from "./field-binding.ts";
import { setPregnancy } from "./pregnancy-operations.ts";
import type { PregnancyView } from "./pregnancy-data.ts";

/** Bind controls to a captured couple, so switching farmers cannot retarget work. */
export function createPregnancyDomain(
	view: ImmutableView<PregnancyView>,
	model: DomainEditPort,
) {
	const targetKey = view.targetKey ?? "";
	const key = `pregnancy:${JSON.stringify([view.farmerId, targetKey])}`;
	return {
		...view,
		expectingField: bindImmediateField(
			model,
			{
				key: `${key}:expecting`,
				label: "Expecting a baby",
				value: view.expecting,
				available: view.supported,
				reason: view.reason,
			},
			(expecting) =>
				setPregnancy({ farmerId: view.farmerId, targetKey, expecting }),
		),
		daysField: bindImmediateField(
			model,
			{
				key: `${key}:days`,
				label: "Days until birth",
				value: view.daysUntilBirth,
				available: view.supported && view.expecting,
				reason: view.reason,
				constraints: { min: 1, max: 112 * MAX_YEAR, step: 1 },
			},
			(days) =>
				setPregnancy({
					farmerId: view.farmerId,
					targetKey,
					expecting: true,
					days,
				}),
		),
	};
}
export type PregnancyDomain = ReturnType<typeof createPregnancyDomain>;
