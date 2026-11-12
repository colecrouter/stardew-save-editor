import { savedType, isKnownLocation } from "./saved-types.ts";
import type { Location, SaveDocument } from "./domain.ts";
import type { T_StardewValley_Objects_Chest as Chest } from "../../../generated/save-format/save.ts";

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
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
	raw: Chest;
	supported: boolean;
	reason?: string;
	slots: unknown[];
	serializedLength: number;
}

/** Null slots are vacant; placed chests compact them only on an explicit edit. */
export function emptyChestSlot(value: unknown): boolean {
	return value === null || value === undefined;
}
// A nonempty ID addresses shared storage rather than this chest's local inventory.
function emptyGlobalInventoryId(value: unknown): boolean {
	return value === undefined || value === null || value === "";
}

function describe(
	raw: Chest,
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
	if (!emptyGlobalInventoryId(raw.globalInventoryId))
		reason = "This chest uses a shared or unsupported global inventory.";

	const container = raw.items;
	const entries = Array.isArray(container) ? container : [];
	if (
		(container !== undefined && !Array.isArray(container)) ||
		entries.some((value) => !record(value) && value !== null)
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
					index < entries.length ? entries[index] : null,
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
	const game = document.SaveGame;
	const locations = game.locations;
	const result: PlacedChest[] = [];
	const isChest = (raw: unknown): raw is Chest =>
		record(raw) &&
		raw.$type !== "$unknown" &&
		(savedType(raw) === "Chest" ||
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
	const visit = (
		value: Location | null | undefined,
		path: string,
		parent?: string,
	) => {
		if (!isKnownLocation(value)) return;
		const ownName =
			text(value.uniqueName) || text(value.name) || "Unknown location";
		const location = parent ? `${parent} / ${ownName}` : ownName;
		add(value.fridge, `${path}.fridge`, location, "fridge", "", "Fridge");
		const objects = value.objects ?? [];
		objects.forEach((entry, index) => {
			if (!record(entry) || !record(entry.value)) return;
			const raw = entry.value;
			const vector = record(entry.key) ? entry.key : undefined;
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
		const buildings = value.buildings ?? [];
		buildings.forEach((building, index) => {
			if (!building || building.$type === "$unknown") return;
			const label = text(building.buildingType) || `Building ${index + 1}`;
			const buildingPath = `${path}.buildings.${index}`;
			const chests = building.buildingChests ?? [];
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
	(locations ?? []).forEach((location, index) => {
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
		slots.some((value) => !emptyChestSlot(value) && !record(value))
	)
		throw new Error("Unsupported chest inventory");
	// Generic inventory commands carry opaque values until this storage boundary.
	// A supported chest only receives decoded item records; this predicate retains
	// their generated item type while removing the view's virtual empty slots.
	const entries = slots.filter(
		(value): value is NonNullable<Chest["items"]>[number] =>
			!emptyChestSlot(value),
	);
	// Storage stays compact; the view supplies virtual empty slots up to capacity.
	chest.raw.items = entries;
}
