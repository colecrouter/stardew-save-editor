import { type T_StardewValley_Objects_Chest as Chest } from "../../../generated/save-format/save.ts";
import { type Location, type SaveDocument } from "./domain.ts";
import { type InventorySlot, type InventoryValue } from "./inventory-values.ts";
import { nonemptyText } from "./plain-data.ts";
import { isKnownLocation } from "./saved-types.ts";

/** A reachable local storage inventory; raw references belong only to the supplied document. */
export interface PlacedChest {
	id: string;
	/** Source semantics govern conversion eligibility, even when raw chest flags match. */
	source: "chest" | "fridge" | "machine" | "building";
	name: string;
	label: string;
	location: string;
	capacity: number;
	container: Chest;
	supported: boolean;
	reason?: string;
	slots: InventorySlot[];
	serializedLength: number;
}

/** Null slots are vacant; placed chests compact them only on an explicit edit. */
export function emptyChestSlot(item: InventoryValue): boolean {
	return item === null || item === undefined;
}
function describe(
	container: Chest,
	id: string,
	location: string,
	tile: string,
	source: PlacedChest["source"],
	labelName?: string,
): PlacedChest {
	const name = nonemptyText(container.name) ?? "Chest";
	const special = container.specialChestType;
	const capacity =
		special === "BigChest" ||
		container.itemId === "BigChest" ||
		container.itemId === "BigStoneChest" ||
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
	// A nonempty ID addresses shared storage rather than this local inventory.
	if (container.globalInventoryId != null && container.globalInventoryId !== "")
		reason = "This chest uses a shared or unsupported global inventory.";

	// The codec already supplies nullable Item slots at every cardinality.
	const entries = container.items ?? [];
	const supported = reason === undefined;
	const slotCount = Math.max(capacity, entries.length);
	return {
		id,
		name,
		label: `${location} - ${labelName ?? name}${tile}`,
		source,
		location,
		capacity: slotCount,
		container,
		supported,
		...(reason != null && reason !== "" ? { reason } : {}),
		serializedLength: entries.length,
		// Virtual nils give every empty display target an identity without writing
		// capacity-sized arrays into a compact chest just because it was inspected.
		slots: supported
			? Array.from({ length: slotCount }, (_, index) => entries[index] ?? null)
			: [],
	};
}

/** Discover decoded local storage roots without proxy allocation.
 * Existing object chest IDs are unchanged. Additional roots use distinct suffixes;
 * arbitrary nested bags and shared/global inventories are not guessed as local storage. */
export function discoverPlacedChests(
	document: SaveDocument,
	ownerId?: string,
): PlacedChest[] {
	const game = document.SaveGame;
	const locations = game.locations;
	const result: PlacedChest[] = [];
	const add = (
		container: Chest | null | undefined,
		path: string,
		location: string,
		source: PlacedChest["source"],
		tile = "",
		labelName?: string,
	) => {
		if (container == null) return;
		const id = `chest:${path}`;
		// Targeted resolution still visits identity roots but reads item lists only
		// for the selected owner, keeping item property edits bounded.
		if (ownerId === undefined || ownerId === id)
			result.push(describe(container, id, location, tile, source, labelName));
	};
	const visit = (
		knownLocation: Location | null | undefined,
		path: string,
		parent?: string,
	) => {
		if (!isKnownLocation(knownLocation)) return;
		const ownName =
			nonemptyText(knownLocation.uniqueName) ??
			nonemptyText(knownLocation.name) ??
			"Unknown location";
		const location =
			parent != null && parent !== "" ? `${parent} / ${ownName}` : ownName;
		// Only generated house contracts define a fridge. Similarly named extension
		// data on other locations is retained without granting storage authority.
		if (
			knownLocation.$type === "StardewValley.Locations.FarmHouse" ||
			knownLocation.$type === "StardewValley.Locations.Cabin" ||
			knownLocation.$type === "StardewValley.Locations.IslandFarmHouse"
		)
			add(
				knownLocation.fridge,
				`${path}.fridge`,
				location,
				"fridge",
				"",
				"Fridge",
			);
		const objects = knownLocation.objects ?? [];
		objects.forEach((entry, index) => {
			const raw = entry.value;
			const { X: x, Y: y } = entry.key;
			const tile = x !== undefined && y !== undefined ? ` (${x}, ${y})` : "";
			const objectPath = `${path}.objects.${index}`;
			if (raw.$type === "StardewValley.Objects.Chest")
				add(raw, objectPath, location, "chest", tile);
			// Auto-grabbers and similar machines keep storage in heldObject. The old
			// XML-wrapper field `Chest` is extension data, not a decoded storage root.
			if (
				raw.$type !== "$unknown" &&
				raw.heldObject?.$type === "StardewValley.Objects.Chest"
			)
				add(
					raw.heldObject,
					`${objectPath}.heldObject`,
					location,
					"machine",
					tile,
					nonemptyText(raw.name) ?? "Machine",
				);
		});
		const buildings = knownLocation.buildings ?? [];
		for (const [index, building] of (buildings ?? []).entries()) {
			if (!building || building.$type === "$unknown") continue;
			const label =
				nonemptyText(building.buildingType) ?? `Building ${index + 1}`;
			const buildingPath = `${path}.buildings.${index}`;
			const chests = building.buildingChests ?? [];
			for (const [chestIndex, chest] of chests.entries())
				add(
					chest,
					`${buildingPath}.buildingChests.${chestIndex}`,
					`${location} / ${label}`,
					"building",
					"",
					nonemptyText(chest?.name) ?? `Chest ${chestIndex + 1}`,
				);
			visit(
				building.indoors,
				`${buildingPath}.indoors`,
				`${location} / ${label}`,
			);
		}
	};
	(locations ?? []).forEach((location, index) => {
		visit(location, `locations.${index}`);
	});
	return result;
}

/** Replace only a supported chest's compact item list after an explicit structural edit. */
export function writeChestSlots(
	chest: PlacedChest,
	slots: readonly InventorySlot[],
): void {
	if (!chest.supported) throw new Error("Unsupported chest inventory");
	// Storage stays compact; only the virtual nil slots are removed. Every
	// occupied record, including opaque subclasses, retains its exact payload.
	chest.container.items = slots.filter((value) => value !== null);
}
