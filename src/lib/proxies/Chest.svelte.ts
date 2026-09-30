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

export class ChestProxy implements DataProxy<RawChest> {
	public [Raw]: RawChest;
	public readonly inventory: ChestInventory;

	constructor(
		chest: RawChest,
		public readonly metadata: ChestMetadata,
	) {
		this[Raw] = chest;
		this.inventory = new ChestInventory(chest);
	}
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
		if (!isChest(chest) || seen.has(chest)) return;
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
