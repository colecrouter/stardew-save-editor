/**
    Helpers for coops and barns (and sheds, which can be upgraded too): their
    upgrade tiers, which animals can live in them, and the changes the game
    makes inside them when they're upgraded.
*/
import buildings from "$generated/buildings.json";
import farmAnimals from "$generated/farmanimals.json";
import { ItemData, KeyToName } from "$lib/ItemData";
import type { BuildingInfo } from "$lib/proxies/Building.svelte";
import type { IndoorItem, IndoorItemMove } from "$types/buildingUpgrade";
import { type BigCraftable, Fragility } from "$types/items";
import type {
	ItemKV,
	GameLocation as Location,
	Item as SaveItem,
	TileLocation,
} from "$types/save";

export type { IndoorItem, IndoorItemMove };

const allBuildings = buildings as BuildingInfo[];

/**
    Every tier of the building family `type` belongs to, from the first one
    built to the last upgrade (e.g. Coop, Big Coop, Deluxe Coop). Each tier
    names the one it upgrades (`BuildingToUpgrade` in Data/Buildings).
*/
export function upgradeTiers(type: string | undefined): BuildingInfo[] {
	let base = allBuildings.find((b) => b.name === type);
	if (!base) return [];
	const tiers = [base];
	while (base.buildingToUpgrade) {
		const previous = allBuildings.find(
			(b) => b.name === base?.buildingToUpgrade,
		);
		if (!previous || tiers.includes(previous)) break;
		tiers.unshift(previous);
		base = previous;
	}
	for (;;) {
		const top = tiers.at(-1);
		const next = allBuildings.find((b) => b.buildingToUpgrade === top?.name);
		if (!next || tiers.includes(next)) break;
		tiers.push(next);
	}
	return tiers;
}

export interface AnimalOption {
	type: string;
	/** Whether this tier of building can house it */
	allowed: boolean;
	/** Why not, when it can't */
	reason?: string;
}

/**
    The animals that can live in a building (by `ValidOccupantTypes`, as
    `FarmAnimal.CanLiveIn` checks), and whether this tier is big enough for
    each one: Marnie only sells an animal for its `RequiredBuilding` or an
    upgrade of it. Animals with no required building need just the first tier.
*/
export function animalOptions(
	tiers: readonly BuildingInfo[],
	current: string | undefined,
): AnimalOption[] {
	const tier = tiers.findIndex((t) => t.name === current);
	const houses = tiers[tier]?.validOccupantTypes ?? [];
	return farmAnimals
		.filter((animal) => houses.includes(animal.house))
		.map((animal) => {
			const required = animal.requiredBuilding ?? tiers[0]?.name;
			const index = tiers.findIndex((t) => t.name === required);
			return index !== -1 && index <= tier
				? { type: animal.name, allowed: true }
				: { type: animal.name, allowed: false, reason: `needs a ${required}` };
		});
}

/** "Duck", or "Duck 2", "Duck 3"... whichever isn't taken */
export function defaultAnimalName(type: string, taken: ReadonlySet<string>) {
	if (!taken.has(type)) return type;
	for (let n = 2; ; n++) if (!taken.has(`${type} ${n}`)) return `${type} ${n}`;
}

/**
    The conversation topic for buying an animal (AnimalHouse.adoptAnimal). It
    goes by the animal's display type, which in English is its name, except
    that white and brown chickens are both just "Chicken".
*/
export function purchasedAnimalTopic(type: string) {
	const displayType =
		type === "White Chicken" || type === "Brown Chicken" ? "Chicken" : type;
	return `purchasedAnimal_${displayType}`;
}

type Tile = TileLocation;
type Rect = { X: number; Y: number; Width: number; Height: number };

const TILE_SIZE = 64;
const sameTile = (a: Tile, b: Tile) => a.X === b.X && a.Y === b.Y;
const tileRect = (tile: Tile): Rect => ({
	X: tile.X * TILE_SIZE,
	Y: tile.Y * TILE_SIZE,
	Width: TILE_SIZE,
	Height: TILE_SIZE,
});
// Rectangle.Intersects
const intersects = (a: Rect, b: Rect) =>
	a.X < b.X + b.Width &&
	b.X < a.X + a.Width &&
	a.Y < b.Y + b.Height &&
	b.Y < a.Y + a.Height;

/** The qualified item ID, like `(BC)101`, as `ItemRegistry.HasItemId` compares them */
function qualifiedItemId(item: SaveItem, isFurniture = false) {
	const id = String(item.itemId ?? "");
	if (id.startsWith("(")) return id;
	if (isFurniture) return `(F)${id}`;
	return item.bigCraftable ? `(BC)${id}` : `(O)${id}`;
}

const objectsOf = (location: Location): ItemKV[] =>
	Array.isArray(location.objects?.item) ? location.objects.item : [];

const furnitureOf = (location: Location): SaveItem[] =>
	typeof location.furniture === "object" &&
	Array.isArray(location.furniture.Furniture)
		? location.furniture.Furniture
		: [];

const objectAt = (location: Location, tile: Tile) =>
	objectsOf(location).find((entry) => sameTile(entry.key.Vector2, tile));

const furnitureCovering = (location: Location, tile: Tile) =>
	furnitureOf(location).filter(
		(f) => f.boundingBox && intersects(f.boundingBox, tileRect(tile)),
	);

/** What's on a tile: the object there, and any furniture covering it */
function contentsAt(location: Location, tile: Tile): SaveItem[] {
	const object = objectAt(location, tile)?.value.Object;
	return [...(object ? [object] : []), ...furnitureCovering(location, tile)];
}

/** GameLocation.IsTileBlockedBy(tile, Furniture | Objects) */
const isTileBlocked = (location: Location, tile: Tile) =>
	contentsAt(location, tile).length > 0;

/**
    Move an item's tile and bounding box, keeping the box's offset and size.
    Furniture also has a box for when it isn't rotated, which moves with it
    (Furniture.RecalculateBoundingBox).
*/
function setTile(item: SaveItem, tile: Tile) {
	const from = item.tileLocation ?? tile;
	item.tileLocation = { X: tile.X, Y: tile.Y };
	for (const box of [item.boundingBox, item.defaultBoundingBox]) {
		if (!box) continue;
		box.X += (tile.X - from.X) * TILE_SIZE;
		box.Y += (tile.Y - from.Y) * TILE_SIZE;
		if (box.Location) box.Location = { X: box.X, Y: box.Y };
	}
}

/** Something inside a building that the editor couldn't add, take out or move back */
export interface UnplacedItem {
	/** Like "Incubator" */
	name: string;
	/** Qualified item ID, like `(BC)101` */
	itemId: string;
	tile: Tile;
	reason: string;
}

/**
    Move what's on one tile to another, unless the destination is taken
    (GameLocation.moveContents). Objects move if the destination has no object;
    furniture covering the tile moves if no furniture covers the destination.
*/
export function moveContents(
	location: Location,
	from: Tile,
	to: Tile,
	unlessItemId?: string,
) {
	let moved = false;
	const object = objectAt(location, from);
	if (
		object &&
		!objectAt(location, to) &&
		qualifiedItemId(object.value.Object) !== unlessItemId
	) {
		object.key = { Vector2: { X: to.X, Y: to.Y } };
		// objects.Add sets the object's TileLocation to its key
		setTile(object.value.Object, to);
		moved = true;
	}

	for (const piece of furnitureCovering(location, from)) {
		if (
			qualifiedItemId(piece, true) !== unlessItemId &&
			furnitureCovering(location, to).length === 0
		) {
			const tile = piece.tileLocation ?? from;
			setTile(piece, {
				X: to.X + tile.X - from.X,
				Y: to.Y + tile.Y - from.Y,
			});
			moved = true;
		}
	}
	return moved;
}

/**
    Apply a building's `IndoorItemMoves`, as `Building.InitializeIndoor` does on
    an upgrade. With `reverse`, put things back where they were (for a downgrade):
    anything that was moved, whatever it is.

    @returns For a downgrade, what couldn't be moved back because its old spot
        is taken. It stays put, usually in the bigger building's extra space.
*/
export function applyIndoorItemMoves(
	location: Location,
	moves: readonly IndoorItemMove[] = [],
	{ reverse = false } = {},
): UnplacedItem[] {
	const ordered = reverse ? [...moves].reverse() : moves;
	const left = new Map<SaveItem, Tile>();
	for (const move of ordered) {
		const size = move.size ?? { X: 1, Y: 1 };
		const [from, to] = reverse
			? [move.destination, move.source]
			: [move.source, move.destination];
		for (let x = 0; x < size.X; x++)
			for (let y = 0; y < size.Y; y++) {
				const tile = { X: from.X + x, Y: from.Y + y };
				const before = contentsAt(location, tile);
				moveContents(
					location,
					tile,
					{ X: to.X + x, Y: to.Y + y },
					// Only an upgrade leaves an item be (the new tier's own, like the
					// incubator); a downgrade moves back whatever is there
					reverse ? undefined : move.unlessItemId,
				);
				if (!reverse) continue;
				const after = contentsAt(location, tile);
				for (const item of before)
					if (after.includes(item) && !left.has(item)) left.set(item, tile);
			}
	}
	// Unless a later move took it after all
	return [...left]
		.filter(([item, tile]) => contentsAt(location, tile).includes(item))
		.map(([item, tile]) => {
			const isFurniture = furnitureOf(location).includes(item);
			return {
				name: String(item.name ?? qualifiedItemId(item, isFurniture)),
				itemId: qualifiedItemId(item, isFurniture),
				tile: isFurniture ? (item.tileLocation ?? tile) : tile,
				reason: "its old spot is taken",
			};
		});
}

/** A big craftable placed on a tile, the way `ItemRegistry.Create` and `objects.Add` leave it */
function placedBigCraftable(
	data: BigCraftable,
	tile: Tile,
	indestructible: boolean,
): SaveItem {
	const { X, Y } = tileRect(tile);
	const object = {
		isLostItem: false,
		category: -9,
		hasBeenInInventory: false,
		name: data.name,
		parentSheetIndex: data.spriteIndex ?? Number(data._key),
		itemId: data._key,
		specialItem: false,
		isRecipe: false,
		quality: 0,
		stack: 1,
		SpecialVariable: 0,
		tileLocation: { X: tile.X, Y: tile.Y },
		owner: 0,
		type: "Crafting",
		canBeSetDown: true,
		canBeGrabbed: true,
		isSpawnedObject: false,
		questItem: false,
		isOn: true,
		// Indestructible items can't be picked up or broken
		fragility: indestructible
			? Fragility.Indestructible
			: (data.fragility ?? 0),
		price: data.price ?? 0,
		edibility: -300,
		bigCraftable: true,
		setOutdoors: data.canBePlacedOutdoors ?? false,
		setIndoors: data.canBePlacedIndoors ?? false,
		readyForHarvest: false,
		showNextIndex: false,
		flipped: false,
		isLamp: data.isLamp ?? false,
		minutesUntilReady: 0,
		boundingBox: {
			X,
			Y,
			Width: TILE_SIZE,
			Height: TILE_SIZE,
			Location: { X, Y },
			Size: { X: TILE_SIZE, Y: TILE_SIZE },
		},
		scale: { X: 0, Y: 0 },
		uses: 0,
		destroyOvernight: false,
	};
	return object as SaveItem;
}

/** The data for a `(BC)` item, the only kind the game's buildings add */
function bigCraftableData(item: IndoorItem) {
	const id = /^\(BC\)(.+)$/.exec(item.itemId)?.[1];
	if (!id) return undefined;
	try {
		const data = ItemData.get(KeyToName(id, "BigCraftable"));
		return data?._type === "BigCraftable" ? data : undefined;
	} catch {
		return undefined;
	}
}

/** One of a building's own items, as a problem with it */
const unplaced = (item: IndoorItem, reason: string): UnplacedItem => ({
	name: bigCraftableData(item)?.name ?? item.itemId,
	itemId: item.itemId,
	tile: item.tile,
	reason,
});

/**
    Add a building's `IndoorItems` (e.g. a Big Coop's incubator), as
    `Building.InitializeIndoor` does when it's built or upgraded: an item is
    only placed on a free tile. Returns the ones that couldn't be placed.
*/
export function placeIndoorItems(
	location: Location,
	items: readonly IndoorItem[] = [],
): UnplacedItem[] {
	const problems: UnplacedItem[] = [];
	for (const item of items) {
		const existing = objectAt(location, item.tile);
		// Already there (e.g. the feed hopper, which every tier has)
		if (existing && qualifiedItemId(existing.value.Object) === item.itemId)
			continue;
		const data = bigCraftableData(item);
		if (!data) {
			problems.push(unplaced(item, "the editor can't create it"));
			continue;
		}
		if (isTileBlocked(location, item.tile)) {
			problems.push(unplaced(item, "something else is in the way"));
			continue;
		}
		if (typeof location.objects !== "object" || !location.objects)
			location.objects = { item: [] };
		location.objects.item ??= [];
		location.objects.item.push({
			key: { Vector2: { X: item.tile.X, Y: item.tile.Y } },
			value: {
				Object: placedBigCraftable(data, item.tile, !!item.indestructible),
			},
		});
	}
	return problems;
}

/**
    Take out items a building tier added (for a downgrade), if they're still
    where the game put them. One that's holding something (like an incubator
    with an egg) is left alone, and returned.
*/
export function removeIndoorItems(
	location: Location,
	items: readonly IndoorItem[] = [],
): UnplacedItem[] {
	const kept: UnplacedItem[] = [];
	for (const item of items) {
		const existing = objectAt(location, item.tile);
		if (!existing || qualifiedItemId(existing.value.Object) !== item.itemId)
			continue;
		const held = (existing.value.Object as SaveItem & { heldObject?: unknown })
			.heldObject;
		if (held && typeof held === "object") {
			kept.push(unplaced(item, "it has something in it"));
			continue;
		}
		const objects = objectsOf(location);
		objects.splice(objects.indexOf(existing), 1);
	}
	return kept;
}

/** "Incubator at 2, 3: something else is in the way" */
export const describeUnplaced = ({ name, tile, reason }: UnplacedItem) =>
	`${name} at ${tile.X}, ${tile.Y}: ${reason}`;
