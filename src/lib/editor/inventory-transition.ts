import { compareInventoryItems, isInventoryTool } from "../inventory-order.ts";
import { storageCapabilities, storageTypes } from "./storage-policy.ts";
import { Result } from "effect";
import type {
	ResolvedMutation,
	OperationChange,
	SaveDocument,
} from "./domain.ts";
import { MutationError } from "./mutation-error.ts";
import {
	inventoryContainers,
	type InventoryContainer,
} from "./inventory-containers.ts";
import {
	canEquipItem,
	equipmentLabels,
	equipmentSlots,
	trinketAvailable,
	type EquipmentIdentities,
	type InventoryLocation,
} from "./equipment.ts";
import { emptyChestSlot } from "./chest-storage.ts";

/** Session-only item lifetimes travel with records; this state is never exported to XML. */
export interface InventoryIdentityState {
	identities: Record<string, string[]>;
	equipmentIdentities: EquipmentIdentities;
	nextIdentity: number;
}
export type InventoryMutation = Extract<
	ResolvedMutation,
	{
		type:
			| "equipment-swap"
			| "item-place"
			| "item-remove"
			| "item-move"
			| "item-swap"
			| "item-stack"
			| "reorder"
			| "inventory-organize"
			| "inventory-transfer"
			| "chest-type";
	}
>;
export function isInventoryMutation(
	action: ResolvedMutation,
): action is InventoryMutation {
	return [
		"equipment-swap",
		"item-place",
		"item-remove",
		"item-move",
		"item-swap",
		"item-stack",
		"reorder",
		"inventory-organize",
		"inventory-transfer",
		"chest-type",
	].includes(action.type);
}
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const empty = (value: unknown) =>
	value == null ||
	(record(value) &&
		(value["@_xsi:nil"] === true || value["@_xsi:nil"] === "true"));
const invalid = (message: string) => Result.fail(new MutationError(message));
/** Metadata and paired handles staged on the caller's detached draft; publication is still pending. */
type PreparedInventoryTransition = {
	label: string;
	review: OperationChange["review"];
	inventory?: InventoryIdentityState;
};
type Pair = { value: unknown; id?: string };

/** Plan one record/handle transition together. History publishes this result, not
 * a second interpretation of the action. Pure comparison callers omit handles.
 * The caller supplies a detached draft and discards it on failure: this helper
 * may stage writes before a later check fails and must never receive published state. */
export function applyInventoryMutation(
	document: SaveDocument,
	action: InventoryMutation,
	inventory?: InventoryIdentityState,
): Result.Result<PreparedInventoryTransition, MutationError> {
	const owners = inventoryContainers(document);
	const owner = owners.find((candidate) => candidate.id === action.ownerId);
	if (!owner) return invalid("Inventory owner must resolve exactly once");
	// A JSON-shaped engine graph may alias one raw chest at several owner paths.
	// Structural edits cannot independently permute their separate lifetime maps;
	// reject those affected owners rather than corrupting paired identities.
	const distinct = (container: InventoryContainer) => {
		if (container.kind !== "chest") return true;
		const raw = container.storage?.raw;
		return (
			raw !== undefined &&
			owners.filter((candidate) => candidate.storage?.raw === raw).length === 1
		);
	};
	if (!distinct(owner))
		return invalid("This storage is aliased at multiple saved paths");
	if ("toOwnerId" in action) {
		const destination = owners.find(
			(candidate) => candidate.id === action.toOwnerId,
		);
		if (destination && !distinct(destination))
			return invalid(
				"The destination storage is aliased at multiple saved paths",
			);
	}

	const opened = new Map<
		string,
		{ owner: InventoryContainer; pairs: Pair[] }
	>();
	let working = inventory;
	const pairsFor = (container: InventoryContainer) => {
		const existing = opened.get(container.id);
		if (existing) return existing.pairs;
		const pairs = container.slots.map((value, index) => ({
			value,
			id: inventory?.identities[container.id]?.[index],
		}));
		opened.set(container.id, { owner: container, pairs });
		return pairs;
	};
	const validLocation = (
		container: InventoryContainer,
		location: InventoryLocation,
	) =>
		typeof location === "number"
			? Number.isInteger(location) &&
				location >= 0 &&
				location < container.slots.length
			: !!container.farmer && equipmentSlots.includes(location);
	const pairAt = (
		container: InventoryContainer,
		location: InventoryLocation,
	): Pair =>
		typeof location === "number"
			? (pairsFor(container)[location] ?? { value: undefined })
			: {
					value: container.farmer?.[location],
					id: inventory?.equipmentIdentities[container.id]?.[location],
				};
	const identitiesAvailable = (pair: Pair) =>
		!inventory || pair.id !== undefined;
	const fresh = () => {
		if (!working) return undefined;
		working = { ...working, nextIdentity: working.nextIdentity + 1 };
		return `item:${working.nextIdentity}`;
	};
	const equipmentWrites = new Map<
		string,
		Partial<Record<(typeof equipmentSlots)[number], Pair>>
	>();
	const put = (
		container: InventoryContainer,
		location: InventoryLocation,
		pair: Pair,
	) => {
		// Missing equipment moves into a numbered slot as a canonical nil. Retain its
		// identity nevertheless: the empty location is a session-owned lifetime too.
		const value =
			pair.value === undefined ? { "@_xsi:nil": "true" } : pair.value;
		if (typeof location === "number")
			pairsFor(container)[location] = { ...pair, value };
		else
			equipmentWrites.set(container.id, {
				...equipmentWrites.get(container.id),
				[location]: { ...pair, value },
			});
	};
	const finish = (
		label: string,
		review: OperationChange["review"],
	): Result.Result<PreparedInventoryTransition, MutationError> => {
		// Validate every affected chest before either endpoint is written. A nil with
		// extra members cannot be compacted without discarding imported opaque data.
		for (const { owner: container, pairs } of opened.values()) {
			if (container.kind !== "chest") continue;
			if (
				pairs.some(
					(pair) =>
						(emptyChestSlot(pair.value) &&
							record(pair.value) &&
							Object.keys(pair.value).some((key) => key !== "@_xsi:nil")) ||
						(!emptyChestSlot(pair.value) && !record(pair.value)),
				)
			)
				return invalid("Unsupported chest inventory");
		}
		for (const { owner: container, pairs } of opened.values()) {
			// One partition orders both the serialized records and their handles. Virtual
			// empties follow occupied slots; discovery supplies the resulting capacity.
			const ordered =
				container.kind === "chest"
					? [
							...pairs.filter((pair) => !emptyChestSlot(pair.value)),
							...pairs.filter((pair) => emptyChestSlot(pair.value)),
						]
					: pairs;
			container.write(ordered.map((pair) => pair.value));
			if (working) {
				const count =
					container.kind === "chest"
						? inventoryContainers(document).find(
								(candidate) => candidate.id === container.id,
							)?.slots.length
						: ordered.length;
				if (count === undefined)
					return invalid("Chest changed during inventory operation");
				const ids = ordered.slice(0, count).map((pair) => pair.id);
				if (ids.some((id) => id === undefined))
					return invalid("Inventory identities are unavailable");
				working = {
					...working,
					identities: {
						...working.identities,
						[container.id]: ids.filter((id): id is string => id !== undefined),
					},
				};
			}
		}
		for (const [id, writes] of equipmentWrites) {
			const container = owners.find((candidate) => candidate.id === id);
			if (!container?.farmer)
				return invalid("Chests do not have equipment slots");
			for (const key of equipmentSlots) {
				const pair = writes[key];
				if (!pair) continue;
				container.farmer[key] = pair.value;
				if (working && pair.id !== undefined) {
					const previous = working.equipmentIdentities[id];
					if (!previous) return invalid("Equipment identities are unavailable");
					working = {
						...working,
						equipmentIdentities: {
							...working.equipmentIdentities,
							[id]: { ...previous, [key]: pair.id },
						},
					};
				}
			}
		}
		return Result.succeed({
			label,
			review,
			...(working ? { inventory: working } : {}),
		});
	};
	if (action.type === "inventory-organize") {
		const pairs = pairsFor(owner);
		if (
			pairs.some(
				(pair) =>
					!identitiesAvailable(pair) ||
					(!empty(pair.value) && !record(pair.value)),
			)
		)
			return invalid("This inventory cannot be organized safely");
		// Organizing an empty owner changes no order. Do not serialize its virtual
		// display slots: that would normalize imported empties and discard Redo.
		if (pairs.every((pair) => empty(pair.value)))
			return Result.succeed({
				label: `Organize ${owner.name}`,
				review: "standalone",
				...(working ? { inventory: working } : {}),
			});

		// Organize is a stable permutation only: each complete item/empty record
		// travels with its own handle. Stack merging remains an independent feature.
		const tools = pairs.filter(
			(pair) =>
				record(pair.value) && !empty(pair.value) && isInventoryTool(pair.value),
		);
		const rest = pairs.filter(
			(pair) => !empty(pair.value) && !tools.includes(pair),
		);
		rest.sort((a, b) =>
			record(a.value) && record(b.value)
				? compareInventoryItems(a.value, b.value)
				: 0,
		);
		opened.set(owner.id, {
			owner,
			pairs: [...tools, ...rest, ...pairs.filter((pair) => empty(pair.value))],
		});
		return finish(`Organize ${owner.name}`, "standalone");
	}
	if (action.type === "inventory-transfer") {
		if (!inventory || !Array.isArray(action.sources) || !action.sources.length)
			return invalid("Choose the items to transfer");
		const seen = new Set<string>();
		const moving: {
			container: InventoryContainer;
			slot: number;
			pair: Pair;
		}[] = [];
		for (const source of action.sources) {
			if (
				!source ||
				typeof source.ownerId !== "string" ||
				typeof source.entityId !== "string" ||
				seen.has(source.entityId)
			)
				return invalid("Selected item handles must be unique");
			seen.add(source.entityId);
			const container = owners.find(
				(candidate) => candidate.id === source.ownerId,
			);
			const slot =
				inventory.identities[source.ownerId]?.indexOf(source.entityId) ?? -1;
			if (!container || slot < 0 || !distinct(container))
				return invalid("A selected item no longer belongs to its inventory");
			const pair = pairAt(container, slot);
			if (empty(pair.value) || !record(pair.value))
				return invalid("A selected item is no longer available");
			if (container.id !== owner.id) moving.push({ container, slot, pair });
		}
		if (!moving.length)
			return Result.succeed({
				label: "Items already belong to this inventory",
				review: "compact",
				inventory,
			});
		const free = pairsFor(owner).flatMap((pair, index) =>
			empty(pair.value) ? [index] : [],
		);
		if (moving.length > free.length)
			return invalid(
				`${moving.length} items need room; ${owner.name} has ${free.length} free slots`,
			);
		// Validate the complete batch before staging swaps. Empty markers move back
		// to the source too, preserving any supported imported representation.
		for (const [index, source] of moving.entries()) {
			const target = free[index];
			if (target === undefined)
				throw new Error("Validated transfer has no destination");
			const displaced = pairAt(owner, target);
			put(owner, target, source.pair);
			put(source.container, source.slot, displaced);
		}
		return finish(
			`Transfer ${moving.length} items to ${owner.name}`,
			"standalone",
		);
	}
	if (action.type === "chest-type") {
		const chest = owner.storage;
		const target = storageTypes.find(
			(candidate) => candidate.itemId === action.itemId,
		);
		const capability = chest && storageCapabilities(chest.raw, chest.source);
		if (
			!chest ||
			!target ||
			!capability ||
			(!capability.typeId && !capability.miniShippingBin)
		)
			return invalid("This container's type cannot be changed");
		if (
			capability.miniShippingBin &&
			(target.itemId !== "130" || capability.expansionReason)
		)
			return invalid(
				capability.expansionReason ??
					"Mini-Shipping Bins can only expand to a Chest",
			);
		const pairs = pairsFor(owner),
			occupied = pairs.filter((pair) => !empty(pair.value)),
			empties = pairs.filter((pair) => empty(pair.value));
		if (occupied.length > target.capacity)
			return invalid(
				`${occupied.length} items do not fit in ${target.capacity} slots`,
			);
		if (inventory && pairs.some((pair) => !identitiesAvailable(pair)))
			return invalid("Inventory identities are unavailable");
		// Keep every occupied lifetime. Growth allocates only new empty handles;
		// shrinking drops surplus virtual empties, which Undo restores exactly.
		const arranged = [...occupied, ...empties].slice(0, target.capacity);
		while (arranged.length < target.capacity)
			arranged.push({ value: undefined, id: fresh() });
		Object.assign(chest.raw, {
			itemId: target.itemId,
			name: target.name,
			parentSheetIndex: target.spriteIndex,
			specialChestType: target.special,
			currentLidFrame: target.spriteIndex + 1,
		});
		opened.set(owner.id, { owner, pairs: arranged });
		return finish(`Change container to ${target.name}`, "standalone");
	}

	if (action.type === "reorder") {
		if (!owner.farmer) return invalid("Only farmer backpacks can be reordered");
		const pairs = pairsFor(owner);
		if (
			action.order.length !== pairs.length ||
			new Set(action.order).size !== pairs.length ||
			action.order.some(
				(index) =>
					!Number.isInteger(index) || index < 0 || index >= pairs.length,
			)
		)
			return invalid("Order must be a permutation of all slots");
		if (inventory && pairs.some((pair) => !identitiesAvailable(pair)))
			return invalid("Inventory identities are unavailable");
		opened.set(owner.id, {
			owner,
			pairs: action.order.map((index) => pairs[index] ?? { value: undefined }),
		});
		return finish(`Reorder ${owner.name}'s backpack`, "compact");
	}
	if (!validLocation(owner, action.slot))
		return invalid("Slot is outside the inventory");
	const source = pairAt(owner, action.slot);
	if (!identitiesAvailable(source))
		return invalid("Inventory identities are unavailable");
	if (action.type === "item-stack") {
		const item = source.value;
		if (
			!owner.farmer ||
			!record(item) ||
			String(item.itemId) !== action.itemId ||
			typeof item.stack !== "number" ||
			item["@_xsi:type"] !== "Object" ||
			item.bigCraftable === true
		)
			return invalid(
				"Selected slot no longer holds a supported stackable object",
			);
		if (
			!Number.isInteger(action.value) ||
			action.value < 1 ||
			action.value > 999
		)
			return invalid("Stack must be a whole number from 1 to 999");
		item.stack = action.value;
		return finish(
			`Set ${owner.name}'s slot ${action.slot + 1} stack`,
			"standalone",
		);
	}
	if (action.type === "item-place") {
		if (!empty(source.value)) return invalid("Destination slot is occupied");
		if (!record(action.item) || empty(action.item))
			return invalid("An item must be a nonempty save record");
		put(owner, action.slot, {
			value: structuredClone(action.item),
			id: fresh(),
		});
		return finish(
			`Add item to ${owner.name} (slot ${action.slot + 1})`,
			"standalone",
		);
	}
	if (empty(source.value)) return invalid("Source slot is empty");
	if (action.type === "item-remove") {
		put(owner, action.slot, { value: { "@_xsi:nil": "true" }, id: fresh() });
		return finish(
			`Remove item from ${owner.name} (slot ${action.slot + 1})`,
			"standalone",
		);
	}
	const destinationOwner =
		action.toOwnerId === owner.id
			? owner
			: owners.find((candidate) => candidate.id === action.toOwnerId);
	if (!destinationOwner)
		return invalid("Destination inventory owner must resolve exactly once");
	if (!validLocation(destinationOwner, action.toSlot))
		return invalid("Slot is outside the inventory");
	const destination = pairAt(destinationOwner, action.toSlot);
	if (!identitiesAvailable(destination))
		return invalid("Inventory identities are unavailable");
	// A self-drop must not compact a chest or materialize absent equipment.
	if (owner.id === destinationOwner.id && action.slot === action.toSlot)
		return Result.succeed({
			label: "Move item",
			review: "compact",
			...(inventory ? { inventory } : {}),
		});
	if (action.type === "item-move" && !empty(destination.value))
		return invalid("Destination slot is occupied");
	if (action.type === "equipment-swap") {
		for (const [container, key, pair] of [
			[destinationOwner, action.toSlot, source],
			[owner, action.slot, destination],
		] as const) {
			if (typeof key === "number") continue;
			if (!canEquipItem(pair.value, key))
				return invalid(
					`This item cannot go in the ${equipmentLabels[key].toLowerCase()} slot.`,
				);
			if (
				key === "trinketItem" &&
				!empty(pair.value) &&
				!trinketAvailable(container.farmer)
			)
				return invalid("The trinket slot is locked for this farmer.");
		}
	}
	put(owner, action.slot, destination);
	put(destinationOwner, action.toSlot, source);
	const locationLabel = (location: InventoryLocation) =>
		typeof location === "number"
			? `slot ${location + 1}`
			: equipmentLabels[location].toLowerCase();
	return finish(
		action.type === "equipment-swap"
			? `${empty(destination.value) ? "Move" : "Swap"} item from ${owner.name}’s ${locationLabel(action.slot)} to ${destinationOwner.name}’s ${locationLabel(action.toSlot)}`
			: `${empty(destination.value) ? "Move" : "Swap"} item from ${owner.name} (slot ${Number(action.slot) + 1}) to ${destinationOwner.name} (slot ${Number(action.toSlot) + 1})`,
		owner.id === destinationOwner.id && action.type !== "equipment-swap"
			? "compact"
			: "standalone",
	);
}

/** Authorize a trusted replacement and its new lifetime as one staging step. */
export function replaceInventorySlot(
	owner: InventoryContainer,
	slot: number,
	value: Record<string, unknown>,
	inventory: InventoryIdentityState,
): Result.Result<InventoryIdentityState, MutationError> {
	const previous = inventory.identities[owner.id];
	if (!previous || previous[slot] === undefined)
		return invalid("Reward slot is no longer available");
	const ids = [...previous];
	const nextIdentity = inventory.nextIdentity + 1;
	ids[slot] = `item:${nextIdentity}`;
	owner.slots[slot] = value;
	return Result.succeed({
		...inventory,
		nextIdentity,
		identities: { ...inventory.identities, [owner.id]: ids },
	});
}
/** A validated capacity edit preserves retained slots and allocates new empty lifetimes.
 * The capability caller has already rejected truncating occupied or opaque slots. */
export function resizeInventorySlots(
	owner: InventoryContainer,
	size: number,
	inventory: InventoryIdentityState,
): Result.Result<InventoryIdentityState, MutationError> {
	if (!owner.farmer) return invalid("Only farmer backpacks can be resized");
	const previous = inventory.identities[owner.id];
	if (!previous || previous.length !== owner.slots.length)
		return invalid("Backpack identities no longer match its slots");
	const ids = previous.slice(0, size);
	let nextIdentity = inventory.nextIdentity;
	owner.slots.length = Math.min(size, owner.slots.length);
	while (owner.slots.length < size) owner.slots.push({ "@_xsi:nil": "true" });
	while (ids.length < size) ids.push(`item:${++nextIdentity}`);
	// Stardew stores capacity separately from the array; both describe this accepted edit.
	Object.assign(owner.farmer, { maxItems: size });
	return Result.succeed({
		...inventory,
		nextIdentity,
		identities: { ...inventory.identities, [owner.id]: ids },
	});
}
