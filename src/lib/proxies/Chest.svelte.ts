import { storageTypes as SwappableChests } from "../storageTypes.ts";
import { SvelteMap } from "svelte/reactivity";
import type {
	Building as RawBuilding,
	GameLocation as RawGameLocation,
	Item as RawItem,
	Save,
} from "$types/save";
import { type DataProxy, Dispose, Raw } from ".";
import { createItemProxy, type ItemProxy } from "./items";

type NilItem = { "@_xsi:nil": "true" };
type RawItemContainer = { Item: (RawItem | NilItem)[] } | "" | undefined;

export type RawChest = RawItem & {
	items?: RawItemContainer;
	playerChest?: boolean;
	fridge?: boolean;
	specialChestType?: string;
	globalInventoryId?: { string?: string } | "";
	currentLidFrame?: number;
	separateWalletItems?: unknown;
};

export type ChestKind = "chest" | "fridge" | "machine" | "building";

export interface ChestMetadata {
	id: string;
	label: string;
	kind: ChestKind;
	location: string;
	building?: string;
	x?: number;
	y?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isNilItem = (value: unknown): value is NilItem =>
	isRecord(value) && value["@_xsi:nil"] === "true";

const asArray = <T>(value: T | T[] | undefined): T[] => {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
};

const rawItems = (chest: RawChest): RawItem[] => {
	if (!isRecord(chest.items)) return [];
	return asArray(chest.items.Item).filter(
		(item): item is RawItem => isRecord(item) && !isNilItem(item),
	);
};

const chestCapacity = (chest: RawChest) => {
	const name = chest.name?.toLowerCase();
	const special = chest.specialChestType?.toLowerCase();
	if (name === "big chest" || special === "bigchest") return 70;
	if (
		name === "mini-shipping bin" ||
		name === "mini shipping bin" ||
		special === "minishippingbin"
	)
		return 9;
	return 36;
};

/**
 * A chest uses a compact XML item list rather than the player's fixed slot array.
 * The map supplies stable UI slots while writes only replace the chest's own
 * `items.Item` list, preserving every other field on the chest and its location.
 */
export class ChestInventory extends SvelteMap<number, ItemProxy | undefined> {
	public slotCount: number;
	readonly #chest: RawChest;

	constructor(chest: RawChest) {
		super();
		this.#chest = chest;
		const entries = rawItems(chest);
		this.slotCount = $state(Math.max(chestCapacity(chest), entries.length));

		for (let index = 0; index < this.slotCount; index++) {
			const entry = entries[index];
			super.set(index, entry ? createItemProxy(entry) : undefined);
		}
	}

	get usedSlots() {
		let count = 0;
		for (let index = 0; index < this.slotCount; index++) {
			if (this.get(index)) count++;
		}
		return count;
	}

	public set(index: number, value: ItemProxy | undefined): this {
		if (!Number.isInteger(index) || index < 0 || index >= this.slotCount) {
			throw new Error(`Invalid chest slot: ${index}`);
		}

		const previous = this.get(index);
		if (previous && previous !== value) previous[Dispose]?.();
		super.set(index, value);
		this.syncRawItems();
		return this;
	}

	/** Remove an item to move it elsewhere; unlike delete(), it stays usable */
	public take(index: number): ItemProxy | undefined {
		const item = this.get(index);
		super.set(index, undefined);
		this.syncRawItems();
		return item;
	}

	/** Put an item taken from somewhere else into an empty slot */
	public place(index: number, item: ItemProxy) {
		if (!Number.isInteger(index) || index < 0 || index >= this.slotCount) {
			throw new Error(`Invalid chest slot: ${index}`);
		}
		if (this.get(index)) throw new Error(`Chest slot ${index} isn't empty`);
		super.set(index, item);
		this.syncRawItems();
	}

	/** Replace every slot at once, in order (used by sorting) */
	public arrange(items: ItemProxy[]) {
		if (items.length > this.slotCount) {
			throw new Error(
				`${items.length} items won't fit in ${this.slotCount} slots`,
			);
		}
		for (let index = 0; index < this.slotCount; index++) {
			super.set(index, items[index]);
		}
		this.syncRawItems();
	}

	/**
	 * Change how many slots the chest has. Items keep their slots when they
	 * still fit, otherwise they move up to close the gaps; if there are more
	 * items than slots, nothing changes.
	 */
	public resize(slotCount: number) {
		const slots = Array.from({ length: this.slotCount }, (_, index) =>
			this.get(index),
		);
		const items = slots.filter((item) => item !== undefined);
		if (items.length > slotCount) {
			throw new Error(`${items.length} items won't fit in ${slotCount} slots`);
		}

		const keepSlots = !slots.slice(slotCount).some(Boolean);
		super.clear();
		this.slotCount = slotCount;
		for (let index = 0; index < slotCount; index++) {
			super.set(index, keepSlots ? slots[index] : items[index]);
		}
		this.syncRawItems();
	}

	public delete(index: number): boolean {
		const existed = this.get(index) !== undefined;
		this.set(index, undefined);
		return existed;
	}

	private syncRawItems() {
		const entries: RawItem[] = [];
		for (let index = 0; index < this.slotCount; index++) {
			const item = this.get(index);
			if (item) entries.push(item[Raw]);
		}
		this.#chest.items = entries.length ? { Item: entries } : "";
	}
}

/**
 * The chests the game lets you swap for one another in place, keeping their
 * items (big craftables tagged `swappable_chest`). The big ones have 70 slots
 * (Chest.GetActualCapacity).
 */
export { storageTypes as SwappableChests } from "../storageTypes.ts";

export type SwappableChest = (typeof SwappableChests)[number];

const MINI_SHIPPING_BIN = "248";

/** Whether there's a saved item anywhere inside `value` */
const holdsItems = (value: unknown): boolean =>
	isRecord(value) &&
	("itemId" in value || Object.values(value).some(holdsItems));

export class ChestProxy implements DataProxy<RawChest> {
	public [Raw]: RawChest;
	public readonly inventory: ChestInventory;
	public readonly metadata: ChestMetadata;
	/** The chest's kind, when it's one that can be swapped for another */
	public type: SwappableChest | undefined = $state.raw();

	constructor(chest: RawChest, metadata: ChestMetadata) {
		this[Raw] = chest;
		this.inventory = new ChestInventory(chest);
		// Reactive, so the label follows the chest when its type changes
		this.metadata = $state(metadata);
		if (this.#placedByPlayer) {
			this.type = SwappableChests.find(
				(type) => type.itemId === String(chest.itemId),
			);
		}
	}

	/** Placed by a player, rather than a fridge, or a machine's or building's storage */
	get #placedByPlayer() {
		return this.metadata.kind === "chest" && this[Raw].playerChest === true;
	}

	get isMiniShippingBin() {
		return (
			this.#placedByPlayer && String(this[Raw].itemId) === MINI_SHIPPING_BIN
		);
	}

	/**
	 * With separate wallets, a Mini-Shipping Bin keeps each farmer's items
	 * apart from its own list. A Chest would never show them.
	 */
	get hasSeparateWalletItems() {
		return holdsItems(this[Raw].separateWalletItems);
	}

	/**
	 * Swap the chest for another kind, as placing one swappable chest on
	 * another does in-game. Its items stay, so a smaller kind is refused unless
	 * they all fit. Unlike in-game, its colour stays too.
	 */
	setType(type: SwappableChest) {
		if (!this.type) throw new Error("This container's type can't be changed");
		this.inventory.resize(type.capacity);
		this.#become(type);
	}

	/**
	 * Turn a Mini-Shipping Bin into a regular 36-slot Chest. It keeps its
	 * items, but they're no longer shipped overnight.
	 */
	expandMiniShippingBin() {
		if (!this.isMiniShippingBin) throw new Error("Not a Mini-Shipping Bin");
		if (this.hasSeparateWalletItems) {
			throw new Error(
				"This bin holds items for separate wallets, which a Chest wouldn't show",
			);
		}
		const [chest] = SwappableChests;
		this.inventory.resize(chest.capacity);
		this.#become(chest);
	}

	#become(type: SwappableChest) {
		const chest = this[Raw];
		const previous = text(chest.name) ?? "Chest";
		// The game goes by the item ID; the name is what the chest is listed as
		chest.name = type.name;
		chest.itemId = type.itemId;
		chest.parentSheetIndex = type.spriteIndex;
		chest.specialChestType = type.special;
		// Saved as currentLidFrame; the lid's frames follow the chest's sprite
		chest.currentLidFrame = type.spriteIndex + 1;
		this.metadata.label = this.metadata.label.replace(
			` - ${previous}`,
			` - ${type.name}`,
		);
		this.type = type;
	}
}

export interface ChestSearchResult {
	chestIndex: number;
	slotIndex: number;
	chest: ChestProxy;
	item: ItemProxy;
}

/** Find every item across all chests whose name contains `term` (case-insensitive). */
export function searchChests(
	chests: ChestProxy[],
	term: string,
): ChestSearchResult[] {
	const needle = term.trim().toLowerCase();
	if (!needle) return [];

	const results: ChestSearchResult[] = [];
	chests.forEach((chest, chestIndex) => {
		for (
			let slotIndex = 0;
			slotIndex < chest.inventory.slotCount;
			slotIndex++
		) {
			const item = chest.inventory.get(slotIndex);
			if (item?.name?.toLowerCase().includes(needle)) {
				results.push({ chestIndex, slotIndex, chest, item });
			}
		}
	});
	return results;
}

const isChest = (value: unknown): value is RawChest => {
	if (!isRecord(value)) return false;
	if (value["@_xsi:type"] === "Chest") return true;
	return (
		"items" in value &&
		("playerChest" in value || "fridge" in value || "specialChestType" in value)
	);
};

const text = (value: unknown) =>
	typeof value === "string" || typeof value === "number"
		? String(value)
		: undefined;

/**
 * Junimo Chests, and any chest with a global inventory ID, show the team's shared
 * inventory in game and never read their own item list, so items moved into them
 * would be lost. They're left out of the editable chests.
 */
const usesGlobalInventory = (chest: RawChest) =>
	chest.specialChestType === "JunimoChest" ||
	(isRecord(chest.globalInventoryId) &&
		text(chest.globalInventoryId.string) !== undefined);

const locationName = (location: RawGameLocation, fallback: string) =>
	text(location.uniqueName) ?? text(location.name) ?? fallback;

const coordinates = (entry: unknown) => {
	if (!isRecord(entry) || !isRecord(entry.key)) return {};
	const vector = isRecord(entry.key.Vector2) ? entry.key.Vector2 : undefined;
	return {
		x: vector ? Number(vector.X) : undefined,
		y: vector ? Number(vector.Y) : undefined,
	};
};

/** Find every editable chest-like item container reachable from save locations. */
export function discoverChests(save: Save): ChestProxy[] {
	const result: ChestProxy[] = [];
	const seen = new Set<object>();

	const add = (chest: unknown, metadata: ChestMetadata) => {
		if (!isChest(chest) || usesGlobalInventory(chest) || seen.has(chest))
			return;
		seen.add(chest);
		result.push(new ChestProxy(chest, metadata));
	};

	const visitLocation = (
		location: RawGameLocation,
		idPath: string,
		displayPath: string,
		parentBuilding?: string,
	) => {
		const locationRecord = location as unknown as Record<string, unknown>;
		const currentLocation = locationName(location, displayPath);
		const area = parentBuilding
			? `${displayPath} / ${parentBuilding}`
			: currentLocation;

		add(locationRecord.fridge, {
			id: `${idPath}.fridge`,
			label: `${area} - Fridge`,
			kind: "fridge",
			location: currentLocation,
			building: parentBuilding,
		});

		const objects = isRecord(locationRecord.objects)
			? asArray(locationRecord.objects.item)
			: [];
		objects.forEach((entry, objectIndex) => {
			if (!isRecord(entry) || !isRecord(entry.value)) return;
			const object = entry.value.Object;
			if (!isRecord(object)) return;
			const { x, y } = coordinates(entry);
			const tile = x !== undefined && y !== undefined ? ` (${x}, ${y})` : "";

			add(object, {
				id: `${idPath}.objects.${objectIndex}`,
				label: `${area} - ${text(object.name) ?? "Chest"}${tile}`,
				kind: "chest",
				location: currentLocation,
				building: parentBuilding,
				x,
				y,
			});

			add(object.Chest, {
				id: `${idPath}.objects.${objectIndex}.Chest`,
				label: `${area} - ${text(object.name) ?? "Machine"}${tile}`,
				kind: "machine",
				location: currentLocation,
				building: parentBuilding,
				x,
				y,
			});

			add(object.heldObject, {
				id: `${idPath}.objects.${objectIndex}.heldObject`,
				label: `${area} - ${text(object.name) ?? "Machine"}${tile}`,
				kind: "machine",
				location: currentLocation,
				building: parentBuilding,
				x,
				y,
			});
		});

		const buildings = isRecord(locationRecord.buildings)
			? asArray(locationRecord.buildings.Building)
			: [];
		buildings.forEach((buildingValue, buildingIndex) => {
			if (!isRecord(buildingValue)) return;
			const building = buildingValue as unknown as RawBuilding;
			const buildingRecord = buildingValue;
			const buildingName = text(building.buildingType) ?? "Building";
			const buildingPath = `${idPath}.buildings.${buildingIndex}`;
			const buildingChests = isRecord(buildingRecord.buildingChests)
				? asArray(buildingRecord.buildingChests.Chest)
				: [];

			buildingChests.forEach((chest, chestIndex) => {
				const chestRecord = isRecord(chest) ? chest : undefined;
				add(chest, {
					id: `${buildingPath}.buildingChests.${chestIndex}`,
					label: `${area} / ${buildingName} - ${text(chestRecord?.name) ?? `Chest ${chestIndex + 1}`}`,
					kind: "building",
					location: currentLocation,
					building: buildingName,
				});
			});

			if (isRecord(buildingRecord.indoors)) {
				visitLocation(
					buildingRecord.indoors as unknown as RawGameLocation,
					buildingPath,
					area,
					buildingName,
				);
			}
		});
	};

	for (const [index, location] of save.locations.GameLocation.entries()) {
		visitLocation(
			location,
			`locations.${index}`,
			locationName(location, `Location ${index + 1}`),
		);
	}

	return result;
}
