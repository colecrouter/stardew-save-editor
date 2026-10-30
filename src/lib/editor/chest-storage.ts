import type { SaveDocument } from "./domain.ts";

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value: unknown): unknown[] =>
	value === undefined || value === ""
		? []
		: Array.isArray(value)
			? value
			: [value];
const text = (value: unknown): string | undefined =>
	typeof value === "string" || typeof value === "number"
		? String(value)
		: undefined;

/** A reachable local storage inventory; raw references belong only to the supplied document. */
export interface PlacedChest {
	id: string;
	/** Source semantics govern conversion eligibility, even when raw chest flags match. */
	source: "chest" | "fridge" | "machine" | "building";
	name: string;
	label: string;
	location: string;
	capacity: number;
	raw: Record<string, unknown>;
	supported: boolean;
	reason?: string;
	slots: unknown[];
	serializedLength: number;
}

/** Chest lists contain records rather than the backpack's persistent empty-slot markers. */
export function emptyChestSlot(value: unknown): boolean {
	return (
		value === null ||
		value === undefined ||
		(record(value) &&
			(value["@_xsi:nil"] === "true" || value["@_xsi:nil"] === true))
	);
}

// A nil with extra fields may carry mod data. Compacting it would silently erase
// those fields, so structural editing stays unavailable rather than guessing.
function opaqueNil(value: unknown): boolean {
	return (
		record(value) &&
		emptyChestSlot(value) &&
		Object.keys(value).some((key) => key !== "@_xsi:nil")
	);
}
function describe(
	raw: Record<string, unknown>,
	id: string,
	location: string,
	tile: string,
	source: PlacedChest["source"],
	labelName?: string,
): PlacedChest {
	const name = text(raw.name) || "Chest";
	const special = raw.specialChestType;
	const capacity =
		special === "BigChest" ||
		raw.itemId === "BigChest" ||
		raw.itemId === "BigStoneChest" ||
		name === "Big Chest" ||
		name === "Big Stone Chest"
			? 70
			: special === "MiniShippingBin"
				? 9
				: 36;
	let reason: string | undefined;
	// Shared inventories are stored elsewhere in the save; their local item list
	// is not a valid transfer target. Unknown special modes are equally conservative.
	if (special === "JunimoChest")
		reason =
			"Junimo Chests use a shared inventory, which is not supported yet.";
	else if (
		special !== undefined &&
		special !== "" &&
		special !== "None" &&
		special !== "BigChest" &&
		special !== "MiniShippingBin"
	)
		reason = "This special chest inventory is not supported.";
	const global = raw.globalInventoryId;
	if (
		global !== undefined &&
		global !== "" &&
		!(
			record(global) &&
			(global.string === "" || global.string === undefined) &&
			Object.keys(global).every((key) => key === "string")
		)
	)
		reason = "This chest uses a shared or unsupported global inventory.";

	const container = raw.items;
	const saved = record(container) ? container.Item : undefined;
	const entries =
		saved === undefined ? [] : Array.isArray(saved) ? saved : [saved];
	// Empty XML nodes and singleton Item nodes are legitimate compact lists.
	// Primitive/non-record members are left untouched and never acquire edit handles.
	if (
		(container !== undefined && container !== "" && !record(container)) ||
		entries.some((value) => !record(value) && value !== null) ||
		entries.some(opaqueNil) ||
		// A malformed nil discriminator cannot be coerced safely or interpreted
		// as an ordinary stored item. Keep that imported container read-only.
		entries.some(
			(value) =>
				record(value) &&
				Object.hasOwn(value, "@_xsi:nil") &&
				![true, false, "true", "false"].includes(
					value["@_xsi:nil"] as boolean | string,
				),
		)
	)
		reason ??= "This chest's saved item list cannot be edited safely.";
	const supported = reason === undefined;
	const slotCount = Math.max(capacity, entries.length);
	return {
		id,
		name,
		label: `${location} - ${labelName ?? name}${tile}`,
		source,
		location,
		capacity: slotCount,
		raw,
		supported,
		...(reason ? { reason } : {}),
		serializedLength: entries.length,
		// Virtual nils give every empty display target an identity without writing
		// capacity-sized arrays into a compact chest just because it was inspected.
		slots: supported
			? Array.from({ length: slotCount }, (_, index) =>
					index < entries.length ? entries[index] : { "@_xsi:nil": "true" },
				)
			: [],
	};
}

/** Discover local chest storage at the same explicit roots as v1, without proxy allocation.
 * Existing object chest IDs are unchanged. Additional roots use distinct suffixes;
 * arbitrary nested bags and shared/global inventories are not guessed as local storage. */
export function discoverPlacedChests(
	document: SaveDocument,
	ownerId?: string,
): PlacedChest[] {
	const game = document.SaveGame as unknown as Record<string, unknown>;
	const locations = record(game.locations)
		? game.locations.GameLocation
		: undefined;
	const result: PlacedChest[] = [];
	const isChest = (raw: unknown): raw is Record<string, unknown> =>
		record(raw) &&
		(raw["@_xsi:type"] === "Chest" ||
			(Object.hasOwn(raw, "items") &&
				["playerChest", "fridge", "specialChestType"].some((key) =>
					Object.hasOwn(raw, key),
				)));
	const add = (
		raw: unknown,
		path: string,
		location: string,
		source: PlacedChest["source"],
		tile = "",
		labelName?: string,
	) => {
		if (!isChest(raw)) return;
		const id = `chest:${path}`;
		// Targeted resolution still traverses identity roots but interprets item lists
		// only for the requested owner, keeping item property edits bounded.
		if (ownerId === undefined || ownerId === id)
			result.push(describe(raw, id, location, tile, source, labelName));
	};
	const visit = (value: unknown, path: string, parent?: string) => {
		if (!record(value)) return;
		const ownName =
			text(value.uniqueName) || text(value.name) || "Unknown location";
		const location = parent ? `${parent} / ${ownName}` : ownName;
		add(value.fridge, `${path}.fridge`, location, "fridge", "", "Fridge");
		const objects = record(value.objects) ? list(value.objects.item) : [];
		objects.forEach((entry, index) => {
			if (!record(entry) || !record(entry.value) || !record(entry.value.Object))
				return;
			const raw = entry.value.Object;
			const vector =
				record(entry.key) && record(entry.key.Vector2)
					? entry.key.Vector2
					: undefined;
			const x = vector && text(vector.X),
				y = vector && text(vector.Y);
			const tile = x !== undefined && y !== undefined ? ` (${x}, ${y})` : "";
			const objectPath = `${path}.objects.${index}`;
			add(raw, objectPath, location, "chest", tile);
			// These are named machine storage roots, not a recursive walk through item
			// contents. A held produce Object cannot accidentally become a container.
			const machine = text(raw.name) || "Machine";
			add(raw.Chest, `${objectPath}.Chest`, location, "machine", tile, machine);
			add(
				raw.heldObject,
				`${objectPath}.heldObject`,
				location,
				"machine",
				tile,
				machine,
			);
		});
		const buildings = record(value.buildings)
			? list(value.buildings.Building)
			: [];
		buildings.forEach((building, index) => {
			if (!record(building)) return;
			const label = text(building.buildingType) || `Building ${index + 1}`;
			const buildingPath = `${path}.buildings.${index}`;
			const chests = record(building.buildingChests)
				? list(building.buildingChests.Chest)
				: [];
			chests.forEach((chest, chestIndex) => {
				add(
					chest,
					`${buildingPath}.buildingChests.${chestIndex}`,
					`${location} / ${label}`,
					"building",
					"",
					record(chest)
						? text(chest.name) || `Chest ${chestIndex + 1}`
						: undefined,
				);
			});
			visit(
				building.indoors,
				`${buildingPath}.indoors`,
				`${location} / ${label}`,
			);
		});
	};
	list(locations).forEach((location, index) => {
		visit(location, `locations.${index}`);
	});
	return result;
}

/** Replace only a supported chest's compact item list after an explicit structural edit. */
export function writeChestSlots(
	chest: PlacedChest,
	slots: readonly unknown[],
): void {
	if (
		!chest.supported ||
		slots.some(opaqueNil) ||
		slots.some((value) => !emptyChestSlot(value) && !record(value))
	)
		throw new Error("Unsupported chest inventory");
	const entries = slots.filter((value) => !emptyChestSlot(value));
	const container = record(chest.raw.items) ? chest.raw.items : undefined;
	// Preserve unknown siblings of Item and the existing singleton shape when
	// possible. Structural edits may compact plain nils; history restores exact XML.
	if (entries.length) {
		chest.raw.items = {
			...container,
			Item:
				entries.length === 1 &&
				container &&
				!Array.isArray(container.Item) &&
				record(container.Item)
					? entries[0]
					: entries,
		};
	} else if (
		container &&
		Object.keys(container).some((key) => key !== "Item")
	) {
		const { Item: _items, ...rest } = container;
		chest.raw.items = rest;
	} else chest.raw.items = "";
}
