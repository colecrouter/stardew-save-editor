import { readEquipmentSlot } from "./equipment.ts";
import { record, samePlainData } from "./plain-data.ts";
import type { HistoryState } from "./history.ts";
import type {
	ItemPropertyChange,
	ItemPropertyField,
} from "./item-properties.ts";
import {
	readBackpacks,
	readChests,
	type InventoryView,
} from "./inventory-views.ts";
import { inventoryContainers } from "./inventory-containers.ts";

/** Reuse the write contract's field/value relationship rather than a second edit vocabulary. */
type RequestedValue<Property, Change = ItemPropertyChange> = Change extends {
	property: infer Key;
	value: infer Value;
}
	? Property extends Key
		? Value
		: never
	: never;
export type InventoryReviewFields = {
	quantity: number;
	quality: number;
} & { [Property in ItemPropertyChange["property"]]: RequestedValue<Property> };
interface ItemRef {
	readonly id: string;
	readonly name: string;
}
interface ItemChangeBase {
	readonly subject: string;
	readonly item: ItemRef;
	readonly label: string;
}
export type InventoryItemFieldChange = {
	[Field in keyof InventoryReviewFields]: ItemChangeBase & {
		readonly _tag: "ItemFieldChanged";
		readonly field: Field;
		readonly before: InventoryReviewFields[Field] | null;
		readonly after: InventoryReviewFields[Field] | null;
	};
}[keyof InventoryReviewFields];
export type InventoryReviewChange =
	| InventoryItemFieldChange
	| (ItemChangeBase & {
			readonly _tag: "ItemAdded" | "ItemRemoved";
			readonly location: string;
			readonly quantity: number | null;
			readonly quality: number | null;
	  })
	| (ItemChangeBase & {
			readonly _tag: "ItemMoved";
			readonly before: string;
			readonly after: string;
	  });

function unreachable(value: never): never {
	// A new field must be handled by the exhaustive switch. Retain unexpected
	// runtime input as diagnostic data without coercing opaque values to text.
	throw new Error("Unhandled inventory review property", { cause: value });
}
const quiver = (value: unknown): value is RequestedValue<"trinket:type"> =>
	value === "normal" ||
	value === "rapid" ||
	value === "heavy" ||
	value === "perfect";
/** Imported values can exceed editor limits; review describes them without validating a new write.
 * The exhaustive switch is derived from the actual request contract: a new
 * writable property must choose its value representation before this builds. */
function fieldChange(
	base: ItemChangeBase,
	field: keyof InventoryReviewFields,
	before: unknown,
	after: unknown,
): InventoryItemFieldChange | undefined {
	const numeric = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value) ? value : null;
	type NumericField = {
		[
			Key in keyof InventoryReviewFields
		]: InventoryReviewFields[Key] extends number ? Key : never;
	}[keyof InventoryReviewFields];
	const numberChange = <Field extends NumericField>(
		field: Field,
	): ItemChangeBase & {
		_tag: "ItemFieldChanged";
		field: Field;
		before: number | null;
		after: number | null;
	} => ({
		...base,
		_tag: "ItemFieldChanged",
		field,
		before: numeric(before),
		after: numeric(after),
	});
	switch (field) {
		case "quantity":
			return numberChange("quantity");
		case "quality":
			return numberChange("quality");
		case "defenseBonus":
			return numberChange("defenseBonus");
		case "immunityBonus":
			return numberChange("immunityBonus");
		case "minDamage":
			return numberChange("minDamage");
		case "maxDamage":
			return numberChange("maxDamage");
		case "addedPrecision":
			return numberChange("addedPrecision");
		case "addedDefense":
			return numberChange("addedDefense");
		case "addedAreaOfEffect":
			return numberChange("addedAreaOfEffect");
		case "knockback":
			return numberChange("knockback");
		case "critMultiplier":
			return numberChange("critMultiplier");
		case "speed":
			return numberChange("speed");
		case "critChance":
			return numberChange("critChance");
		case "price":
			return numberChange("price");
		case "edibility":
			return numberChange("edibility");
		case "trinket:level":
			return numberChange("trinket:level");
		case "trinket:interval":
			return numberChange("trinket:interval");
		case "trinket:freeze":
			return numberChange("trinket:freeze");
		case "trinket:duration":
			return numberChange("trinket:duration");
		case "trinket:minDamage":
			return numberChange("trinket:minDamage");
		case "trinket:delay":
			return numberChange("trinket:delay");
		case "trinket:variant":
			return numberChange("trinket:variant");

		case "isBottomless":
			return {
				...base,
				_tag: "ItemFieldChanged",
				field,
				before: typeof before === "boolean" ? before : null,
				after: typeof after === "boolean" ? after : null,
			};
		case "color":
		case "clothesColor":
			return {
				...base,
				_tag: "ItemFieldChanged",
				field,
				before: typeof before === "string" ? before : null,
				after: typeof after === "string" ? after : null,
			};
		case "trinket:type":
			return {
				...base,
				_tag: "ItemFieldChanged",
				field,
				before: quiver(before) ? before : null,
				after: quiver(after) ? after : null,
			};
		default:
			return unreachable(field);
	}
}

interface ObservedItem {
	id: string;
	name: string;
	location: string;
	locationKey: string;
	quantity?: number;
	quality?: number;
	properties: readonly ItemPropertyField[];
	raw: Record<string, unknown>;
	path?: string;
}
const pointer = (part: string) => part.replace(/~/g, "~0").replace(/\//g, "~1");
/** Locate only the observed records by reference. Paths stay engine-side coverage
 * metadata; UI never needs the raw record or a save-format location lens. */
function attachPaths(document: unknown, items: ObservedItem[]) {
	const targets = new Map<object, ObservedItem[]>();
	for (const item of items)
		targets.set(item.raw, [...(targets.get(item.raw) ?? []), item]);
	function visit(value: unknown, path: string) {
		if (!value || typeof value !== "object") return;
		const found = targets.get(value);
		if (found) for (const item of found) item.path = path;
		for (const [key, child] of Object.entries(value))
			visit(child, `${path}/${pointer(key)}`);
	}
	visit(document, "");
}
function observe(
	state: Pick<HistoryState, "document" | "identities" | "equipmentIdentities">,
): ObservedItem[] {
	const views: InventoryView[] = [
		...readBackpacks(state),
		...readChests(state),
	];
	const containers = new Map(
		inventoryContainers(state.document).map((owner) => [owner.id, owner]),
	);
	const result: ObservedItem[] = [];
	for (const owner of views) {
		if (!owner.supported) continue;
		const rawOwner = containers.get(owner.ownerId);
		if (!rawOwner) continue;
		const title =
			owner.kind === "chest" ? owner.name : `${owner.name} · Backpack`;
		for (const slot of owner.slots) {
			const raw = rawOwner.slots[slot.slot];
			if (slot.empty || !slot.entityId || !record(raw)) continue;
			result.push({
				id: slot.entityId,
				name: slot.name,
				location: `${title} · Slot ${slot.slot + 1}`,
				locationKey: JSON.stringify([owner.ownerId, slot.slot]),
				quantity: slot.quantity,
				quality: slot.quality,
				properties: slot.properties,
				raw,
			});
		}
		for (const equipment of owner.equipment) {
			const raw = readEquipmentSlot(rawOwner.farmer, equipment.key);
			if (equipment.empty || !equipment.entityId || !record(raw)) continue;
			result.push({
				id: equipment.entityId,
				name: equipment.name,
				location: `${owner.name} · ${equipment.label}`,
				locationKey: JSON.stringify([owner.ownerId, equipment.key]),
				quantity: equipment.quantity,
				quality: equipment.quality,
				properties: equipment.properties,
				raw,
			});
		}
	}
	attachPaths(state.document, result);
	return result;
}
const same = samePlainData;
const identityMap = (items: ObservedItem[]) =>
	new Map(items.map((item) => [item.id, item]));

/** Compare import and committed instances even after Undo history eviction. The
 * result contains detached values only; technical coverage remains conservative. */
export function projectInventoryReview(state: HistoryState): {
	changes: InventoryReviewChange[];
	coveredPaths: string[];
} {
	if (!state.net.length) return { changes: [], coveredPaths: [] };
	const initial = observe({
		document: state.baseline,
		identities: state.baselineIdentities,
		equipmentIdentities: state.baselineEquipmentIdentities,
	});
	const latest = observe(state);
	// A handle must be unambiguous on both sides. Ambiguity cannot turn an old
	// instance into a falsely labelled addition merely because one copy vanished.
	const counts = (items: ObservedItem[]) => {
		const result = new Map<string, number>();
		for (const item of items)
			result.set(item.id, (result.get(item.id) ?? 0) + 1);
		return result;
	};
	const initialCounts = counts(initial),
		latestCounts = counts(latest);
	const unique = (item: ObservedItem) =>
		(initialCounts.get(item.id) ?? 0) <= 1 &&
		(latestCounts.get(item.id) ?? 0) <= 1;
	const before = identityMap(initial.filter(unique)),
		after = identityMap(latest.filter(unique));
	const byLocation = (items: ObservedItem[]) =>
		new Map(items.map((item) => [item.locationKey, item]));
	const initialLocations = byLocation(initial),
		latestLocations = byLocation(latest);
	// Instance handles are not exported. Identical slot values can exchange handles
	// (or an item can be removed and recreated) without changing the XML at all.
	const changedLocations = new Set(
		[...initialLocations.keys(), ...latestLocations.keys()].filter(
			(key) =>
				!same(initialLocations.get(key)?.raw, latestLocations.get(key)?.raw),
		),
	);

	const completeLocation = (key: string) => {
		// A JSON pointer identifies a slot, not an instance. Covering its subtree
		// is safe only when BOTH occupants are fully explained. In a swap, an
		// unchanged item must never hide unknown edits on the displaced item.
		for (const occupant of [
			initialLocations.get(key),
			latestLocations.get(key),
		]) {
			if (!occupant) continue;
			if (!unique(occupant)) return false;
			const imported = before.get(occupant.id),
				committed = after.get(occupant.id);
			if (imported && committed && !same(imported.raw, committed.raw))
				return false;
		}
		return true;
	};

	const changes: InventoryReviewChange[] = [],
		coveredPaths: string[] = [];
	for (const id of new Set([...before.keys(), ...after.keys()])) {
		const old = before.get(id),
			current = after.get(id);
		const item = current ?? old;
		if (!item) continue;
		if (
			![old?.locationKey, current?.locationKey].some(
				(key) => key !== undefined && changedLocations.has(key),
			)
		)
			continue;
		const base = {
			item: { id, name: item.name },
			subject: item.name,
			label: item.name,
		};
		if (!old || !current) {
			changes.push({
				...base,
				_tag: old ? "ItemRemoved" : "ItemAdded",
				location: item.location,
				quantity: item.quantity ?? null,
				quality: item.quality ?? null,
			});
			if (item.path && completeLocation(item.locationKey))
				coveredPaths.push(item.path);
			continue;
		}
		const rawChanged = !same(old.raw, current.raw);
		if (old.locationKey !== current.locationKey) {
			changes.push({
				...base,
				_tag: "ItemMoved",
				before: old.location,
				after: current.location,
			});
			// A pure record move accounts for the whole source/destination value.
			// Mixed moves/edits retain parent/coalesced patches in the fallback.
			if (!rawChanged)
				for (const location of [old, current])
					if (location.path && completeLocation(location.locationKey))
						coveredPaths.push(location.path);
		}
		if (!rawChanged) continue;
		const fields = new Map<
			keyof InventoryReviewFields,
			{ label: string; before: unknown; after: unknown }
		>([
			[
				"quantity",
				{ label: "Quantity", before: old.quantity, after: current.quantity },
			],
			[
				"quality",
				{ label: "Quality", before: old.quality, after: current.quality },
			],
		]);
		for (const field of [...old.properties, ...current.properties]) {
			fields.set(field.property, {
				label: field.label,
				before: old.properties.find((row) => row.property === field.property)
					?.value,
				after: current.properties.find((row) => row.property === field.property)
					?.value,
			});
		}
		for (const [field, values] of fields) {
			if (Object.is(values.before, values.after)) continue;
			// Income/RNG-mode edits can change derived trinket stats without editing
			// this item. Only a changed generation seed establishes an item-stat edit.
			if (
				field.startsWith("trinket:") &&
				Object.is(old.raw.generationSeed, current.raw.generationSeed)
			)
				continue;
			const change = fieldChange(
				{
					...base,
					subject: current.location,
					label: values.label,
				},
				field,
				values.before,
				values.after,
			);
			if (!change || Object.is(change.before, change.after)) continue;
			changes.push(change);
			// Trinket values are seed-derived. Their seed/template representation is
			// intentionally left in fallback rather than claiming arbitrary raw fields.
			if (field.startsWith("trinket:")) continue;
			const rawFields =
				field === "quantity"
					? ["stack"]
					: field === "isBottomless"
						? ["isBottomless", "IsBottomless"]
						: [field];
			for (const rawField of rawFields) {
				if (!current.path) continue;
				if (field === "color" || field === "clothesColor") {
					// RGB editing preserves alpha and opaque members; cover only the
					// known channels/mirror, leaving independent alpha changes visible.
					for (const channel of ["R", "G", "B", "PackedValue"])
						coveredPaths.push(`${current.path}/${rawField}/${channel}`);
				} else if (
					// An unavailable domain value must not hide an unsupported scalar
					// (such as a mod's string in a numeric field) behind an em dash.
					(change.before !== null || old.raw[rawField] == null) &&
					(change.after !== null || current.raw[rawField] == null) &&
					!record(old.raw[rawField]) &&
					!Array.isArray(old.raw[rawField]) &&
					!record(current.raw[rawField]) &&
					!Array.isArray(current.raw[rawField])
				) {
					// Unknown structured values are described as unavailable, but their
					// discarded members must still appear in the technical fallback.
					coveredPaths.push(`${current.path}/${pointer(rawField)}`);
				}
			}
		}
	}
	return { changes, coveredPaths: [...new Set(coveredPaths)] };
}
