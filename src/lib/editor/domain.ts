import { Data } from "effect";
import { resolveInventoryContainer } from "./inventory-containers.ts";
import {
	applyEquipmentSwap,
	type InventoryLocation,
	type EquipmentSlot,
} from "./equipment.ts";
import type { BackpackMoveRequest } from "./backpack-movement.ts";
import type { BackpackLifecycleRequest } from "./backpack-lifecycle.ts";
import type { CalendarEdit } from "../calendarDocument.ts";

// Parsed XML consists of plain records, arrays, and primitive values. This
// comparator intentionally does not support class instances, cycles, Maps or Sets.
function equal(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (
		!left ||
		!right ||
		typeof left !== "object" ||
		typeof right !== "object" ||
		Array.isArray(left) !== Array.isArray(right)
	)
		return false;
	const a = left as Record<string, unknown>;
	const b = right as Record<string, unknown>;
	const keys = Object.keys(a);
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
	);
}

// Deliberately narrow lens over a full parsed save. Unknown fields stay attached.
// Equipment fields may be absent or contain opaque imported records. Describing
// their actual keys permits typed access without asserting that their values are valid.
export interface Farmer extends Partial<Record<EquipmentSlot, unknown>> {
	UniqueMultiplayerID: string | number;
	name: string;
	farmName: string;
	money: number;
	// Parrot Egg stat rolls depend on the owning farmer's lifetime earnings.
	totalMoneyEarned?: unknown;
	items: { Item: unknown[] };
}
export interface SaveDocument {
	SaveGame: {
		player: Farmer;
		// World storage is traversed conservatively without asserting a complete game schema.
		locations?: unknown;
		// Trinket seed interpretation follows the save's selected game RNG algorithm.
		// Keep raw context unknown until validated; inspection must not normalize it.
		useLegacyRandom?: unknown;
		farmhands: "" | { Farmer: Farmer[] };
	};
}
export type Mutation =
	| {
			type: "equipment-swap";
			farmerId: string;
			slot: InventoryLocation;
			toFarmerId: string;
			toSlot: InventoryLocation;
	  }
	| BackpackLifecycleRequest
	| BackpackMoveRequest
	| {
			type: "item-swap";
			farmerId: string;
			slot: number;
			toFarmerId: string;
			toSlot: number;
	  }
	| CalendarEdit
	| { type: "bundle-complete"; bundleId: 13 }
	| { type: "item-place"; farmerId: string; slot: number; item: unknown }
	| { type: "item-remove"; farmerId: string; slot: number; entityId?: string }
	| {
			type: "item-move";
			farmerId: string;
			slot: number;
			entityId?: string;
			toFarmerId: string;
			toSlot: number;
	  }
	| { type: "money"; farmerId: string; value: number }
	| {
			type: "item-stack";
			farmerId: string;
			slot: number;
			itemId: string;
			/** Session-owned identity; resolved by the history session before applying. */
			entityId?: string;
			value: number;
	  }
	| { type: "farm-name"; value: string }
	| { type: "reorder"; farmerId: string; order: readonly number[] };
export interface Change {
	path: string;
	before: unknown;
	after: unknown;
}
export interface Receipt {
	intent: Mutation;
	label: string;
	review: "standalone" | "compact";
	changes: Change[];
}
export interface SessionState {
	document: SaveDocument;
	history: Receipt[];
	/** Operation-owned state, carried alongside XML and never exported into it. */
	domainState?: DomainState;
}
export type DomainValue =
	| null
	| boolean
	| number
	| string
	| DomainValue[]
	| { [key: string]: DomainValue };
export type DomainState = Record<string, DomainValue>;
/** Expected operation rejection, usable directly in Effect generators and pure planners. */
export class MutationError extends Data.TaggedError("MutationError")<{
	readonly message: string;
}> {
	constructor(message: string) {
		// Existing pure domain callers throw this same error with a message string.
		super({ message });
	}
}
export const farmers = (document: SaveDocument) => [
	document.SaveGame.player,
	...(document.SaveGame.farmhands === ""
		? []
		: document.SaveGame.farmhands.Farmer),
];

export const emptySlot = (item: unknown) =>
	item === null ||
	item === undefined ||
	(typeof item === "object" &&
		"@_xsi:nil" in item &&
		String(item["@_xsi:nil"]) === "true");

export function apply(
	document: SaveDocument,
	mutation: Mutation,
): {
	label: string;
	review: Receipt["review"];
} {
	if (mutation.type === "equipment-swap")
		return applyEquipmentSwap(document, mutation);
	if (
		mutation.type === "backpack-add" ||
		mutation.type === "backpack-remove" ||
		mutation.type === "backpack-move"
	)
		throw new MutationError(
			"Backpack requests require session identity resolution",
		);
	if (mutation.type === "bundle-complete")
		throw new MutationError(
			"Bundle operations require the bundle domain adapter",
		);
	if (mutation.type === "calendar-date" || mutation.type === "calendar-weather")
		throw new MutationError(
			"Calendar operations require the calendar domain adapter",
		);
	if (mutation.type === "farm-name") {
		if (!mutation.value.trim()) throw new MutationError("Farm name is empty");
		for (const farmer of farmers(document)) farmer.farmName = mutation.value;
		return { label: `Rename farm to ${mutation.value}`, review: "standalone" };
	}
	// Numbered slots share one owner boundary. Chest adapters compact their own
	// serialization only after an explicit structural action, never during reads.
	if (
		mutation.type === "item-place" ||
		mutation.type === "item-remove" ||
		mutation.type === "item-move" ||
		mutation.type === "item-swap"
	) {
		const owner = resolveInventoryContainer(document, mutation.farmerId);
		if (!owner)
			throw new MutationError("Inventory owner must resolve exactly once");
		const slots = owner.slots;
		const check = (index: number, values: unknown[]) => {
			if (!Number.isInteger(index) || index < 0 || index >= values.length)
				throw new MutationError("Slot is outside the inventory");
		};
		check(mutation.slot, slots);
		const item = slots[mutation.slot];
		if (mutation.type === "item-place") {
			if (!emptySlot(item))
				throw new MutationError("Destination slot is occupied");
			if (
				!mutation.item ||
				typeof mutation.item !== "object" ||
				Array.isArray(mutation.item) ||
				emptySlot(mutation.item)
			)
				throw new MutationError("An item must be a nonempty save record");
			slots[mutation.slot] = structuredClone(mutation.item);
			owner.write(slots);
			return {
				label: `Add item to ${owner.name} (slot ${mutation.slot + 1})`,
				review: "standalone",
			};
		}
		if (emptySlot(item)) throw new MutationError("Source slot is empty");
		if (mutation.type === "item-remove") {
			slots[mutation.slot] = { "@_xsi:nil": "true" };
			owner.write(slots);
			return {
				label: `Remove item from ${owner.name} (slot ${mutation.slot + 1})`,
				review: "standalone",
			};
		}
		const target = resolveInventoryContainer(document, mutation.toFarmerId);
		if (!target)
			throw new MutationError(
				"Destination inventory owner must resolve exactly once",
			);
		if (owner.id === target.id && mutation.slot === mutation.toSlot)
			return { label: "Move item", review: "compact" };
		const targetSlots = owner.id === target.id ? slots : target.slots;
		check(mutation.toSlot, targetSlots);
		const destination = targetSlots[mutation.toSlot];
		if (mutation.type === "item-move" && !emptySlot(destination))
			throw new MutationError("Destination slot is occupied");
		// Empty chest targets are virtual nils. Their XML is never padded to capacity;
		// each adapter serializes only its own storage representation after both writes.
		slots[mutation.slot] = destination;
		targetSlots[mutation.toSlot] = item;
		owner.write(slots);
		if (owner.id !== target.id) target.write(targetSlots);
		return {
			label: `${emptySlot(destination) ? "Move" : "Swap"} item from ${owner.name} (slot ${mutation.slot + 1}) to ${target.name} (slot ${mutation.toSlot + 1})`,
			review: owner.id === target.id ? "compact" : "standalone",
		};
	}
	// Opaque farmer records and identifiers are preserved but cannot acquire
	// ownership by coercion, including objects with non-callable toString fields.
	const matches = farmers(document).filter((farmer) => {
		if (!farmer || typeof farmer !== "object") return false;
		const id = farmer.UniqueMultiplayerID;
		return (
			(typeof id === "string" ||
				(typeof id === "number" && Number.isFinite(id))) &&
			String(id) === mutation.farmerId
		);
	});
	const farmer = matches[0];
	if (!farmer || matches.length !== 1)
		throw new MutationError("Farmer ID must resolve exactly once");
	if (mutation.type === "item-stack") {
		const item = farmer.items.Item[mutation.slot];
		if (
			!Number.isInteger(mutation.slot) ||
			mutation.slot < 0 ||
			!item ||
			typeof item !== "object" ||
			!("itemId" in item) ||
			String(item.itemId) !== mutation.itemId ||
			!("stack" in item) ||
			typeof item.stack !== "number" ||
			!("@_xsi:type" in item) ||
			item["@_xsi:type"] !== "Object" ||
			("bigCraftable" in item && item.bigCraftable === true)
		)
			throw new MutationError(
				"Selected slot no longer holds a supported stackable object",
			);
		if (
			!Number.isInteger(mutation.value) ||
			mutation.value < 1 ||
			mutation.value > 999
		)
			throw new MutationError("Stack must be a whole number from 1 to 999");
		item.stack = mutation.value;
		return {
			label: `Set ${farmer.name}'s slot ${mutation.slot + 1} stack`,
			review: "standalone",
		};
	}
	if (mutation.type === "money") {
		// Separate-wallet fixture only: shared-wallet semantics require a domain decision.
		if (
			!Number.isInteger(mutation.value) ||
			mutation.value < 0 ||
			mutation.value > 2147483647
		)
			throw new MutationError("Money must be a nonnegative int32");
		farmer.money = mutation.value;
		return { label: `Set ${farmer.name}'s money`, review: "standalone" };
	}
	const items = farmer.items.Item;
	if (
		mutation.order.length !== items.length ||
		new Set(mutation.order).size !== items.length ||
		mutation.order.some(
			(index) => !Number.isInteger(index) || index < 0 || index >= items.length,
		)
	)
		throw new MutationError("Order must be a permutation of all slots");
	farmer.items.Item = mutation.order.map((index) => items[index]);
	return { label: `Reorder ${farmer.name}'s backpack`, review: "compact" };
}

// Discovery implementation, not a complete semantic diff engine. Arrays are deliberately
// recorded as complete values so a reorder never loses unknown or hidden entries.
export function diff(before: unknown, after: unknown, path = ""): Change[] {
	if (equal(before, after)) return [];
	if (
		before &&
		after &&
		typeof before === "object" &&
		typeof after === "object" &&
		!Array.isArray(before) &&
		!Array.isArray(after)
	) {
		const left = before as Record<string, unknown>;
		const right = after as Record<string, unknown>;
		return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(
			(key) =>
				diff(
					left[key],
					right[key],
					`${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
				),
		);
	}
	return [
		{ path, before: structuredClone(before), after: structuredClone(after) },
	];
}

// Both executors use precisely the same draft/commit protocol. Effect does not
// itself roll back ordinary JavaScript writes.
export function prepare(
	state: SessionState,
	input: Mutation,
	inspect: (draft: SaveDocument) => void = () => {},
): SessionState {
	const mutation = structuredClone(input);
	const draft = structuredClone(state.document);
	const presentation = apply(draft, mutation);
	inspect(draft); // fault injection / final validation, before any publication
	const changes = diff(state.document, draft);
	if (changes.length === 0) return state;
	return {
		...state,
		document: draft,
		history: [...state.history, { intent: mutation, ...presentation, changes }],
	};
}
