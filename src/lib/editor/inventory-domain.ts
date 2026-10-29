import { inventoryQuantity } from "./inventory-policy.ts";
import { Effect } from "effect";
import { bindImmediateField, type ImmediateEditPort } from "./field-binding.ts";
import type { ImmediateField } from "./immediate-field.ts";
import type { BackpackSlotView } from "./inventory-operations.ts";
import {
	setBackpackItem,
	decodeBackpackItemChange,
	setInventoryItemProperty,
} from "./inventory-operations.ts";
import {
	decodeItemPropertyChange,
	type ItemPropertyField,
} from "./item-properties.ts";
import type { EquipmentSlotView } from "./equipment.ts";

/** Inspectors need field editing, not document loading, history or selection ownership. */
export type InventoryEditPort = ImmediateEditPort;
/** Capture an instance handle, not its current slot; moving/choosing another item cannot retarget queued input. */
export function createInventoryQuantityFields(
	port: InventoryEditPort,
	farmerId: string,
	item: BackpackSlotView | EquipmentSlotView,
	canStack: boolean,
	canQuality: boolean,
) {
	const entityId = item.entityId;
	const field = (
		property: "stack" | "quality",
		label: string,
		available: boolean,
	) =>
		bindImmediateField(
			port,
			{
				key: `inventory:${JSON.stringify([farmerId, entityId, property])}`,
				label,
				value: item[property],
				available,
				constraints: property === "stack" ? inventoryQuantity : undefined,
			},
			(value: number) =>
				Effect.fromResult(
					decodeBackpackItemChange({ farmerId, entityId, property, value }),
				).pipe(Effect.flatMap(setBackpackItem)),
		);
	return {
		quantity: field("stack", "Quantity", canStack),
		quality: field("quality", "Quality", canQuality),
	};
}
type PropertyBase = {
	property: ItemPropertyField["property"];
	hint?: string;
	title?: string;
};
export type InventoryPropertyField = PropertyBase &
	(
		| { kind: "number"; field: ImmediateField<number>; readonly: boolean }
		| { kind: "boolean"; field: ImmediateField<boolean> }
		| { kind: "color"; field: ImmediateField<string> }
		| { kind: "select"; field: ImmediateField<string> }
	);
/** Decode at the domain command boundary; presentation never interprets property requests or saved shapes. */
export function createInventoryPropertyField(
	port: InventoryEditPort,
	farmerId: string,
	entityId: string,
	property: ItemPropertyField,
): InventoryPropertyField {
	const key = `inventory:${JSON.stringify([farmerId, entityId, property.property])}`;
	const command = (value: unknown) =>
		Effect.fromResult(
			decodeItemPropertyChange({
				farmerId,
				entityId,
				property: property.property,
				value,
			}),
		).pipe(Effect.flatMap(setInventoryItemProperty));
	const make = <T extends string | number | boolean>(
		value: T | undefined,
		available: boolean,
		encode: (value: T) => unknown = (value) => value,
	) =>
		bindImmediateField(
			port,
			{
				key,
				label: property.label,
				value,
				available,
				constraints: {
					min: property.min,
					max: property.max,
					step: property.step,
				},
			},
			(value: T) => command(encode(value)),
		);
	const base = {
		property: property.property,
		hint: property.hint,
		title: property.title,
	};
	switch (property.kind) {
		case "number":
			return {
				...base,
				kind: "number",
				field: make(
					typeof property.value === "number" ? property.value : undefined,
					typeof property.value === "number",
				),
				readonly: property.min !== undefined && property.min === property.max,
			};
		case "boolean":
			return {
				...base,
				kind: "boolean",
				field: make(
					typeof property.value === "boolean" ? property.value : undefined,
					typeof property.value === "boolean",
				),
			};
		case "color":
			return {
				...base,
				kind: "color",
				field: make(
					typeof property.value === "string" ? property.value : undefined,
					typeof property.value === "string",
				),
			};
		case "select": {
			// Native selects use strings; preserve the domain option's original numeric
			// or text representation when submitting it (e.g. Frog Egg color indices).
			const options = (property.options ?? []).map((option) => ({
				value: String(option.value),
				label: option.label,
			}));
			const field = make(
				String(property.value),
				true,
				(value) =>
					property.options?.find((option) => String(option.value) === value)
						?.value ?? value,
			);
			return { ...base, kind: "select", field: { ...field, options } };
		}
	}
}
