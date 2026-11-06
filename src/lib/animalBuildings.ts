/**
    Helpers for coops and barns (and sheds, which can be upgraded too): their
    upgrade tiers, which animals can live in them, and the changes the game
    makes inside them when they're upgraded.
*/
import { ItemData, KeyToName } from "$lib/ItemData";
import { upgradeTiers, type BuildingInfo } from "./animalBuildingData.ts";
export {
	upgradeTiers,
	animalOptions,
	defaultAnimalName,
	purchasedAnimalTopic,
	buildingTierBlocker,
} from "./animalBuildingData.ts";
export type { BuildingInfo, AnimalOption } from "./animalBuildingData.ts";
import type { Building } from "$types/save";
import type { IndoorItem, IndoorItemMove } from "$types/buildingUpgrade";
import { type BigCraftable, Fragility } from "$types/items";
import type {
	ItemKV,
	GameLocation as Location,
	Item as SaveItem,
	TileLocation,
} from "$types/save";

export type { IndoorItem, IndoorItemMove };

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

/** Stage the game's completed-building changes on a private raw record.
 * Callers validate first and supply progression effects belonging to the same transaction.
 * Warnings preserve obstructed/in-use contents rather than discarding them. */
export function changeBuildingTier(
	raw: Building,
	target: BuildingInfo,
	effects: {
		constructed: (name: string) => void;
		mail: (key: string) => void;
		topic: (key: string) => void;
	},
): UnplacedItem[] {
	const tiers = upgradeTiers(raw.buildingType);
	const from = tiers.findIndex((t) => t.name === raw.buildingType);
	const to = tiers.findIndex((t) => t.name === target.name);
	const problems: UnplacedItem[] = [];
	const interior = raw.indoors;

	for (let i = from + 1; i <= to; i++) {
		const tier = tiers[i];
		if (!tier) continue;
		if (interior) {
			applyIndoorItemMoves(interior, tier.indoorItemMoves);
			problems.push(...placeIndoorItems(interior, tier.indoorItems));
		}
		effects.constructed(tier.name);
		for (const mail of tier.addMailOnBuild ?? []) effects.mail(mail);
		effects.topic(`structureBuilt_${tier.name}`);
	}
	for (let i = from; i > to; i--) {
		const tier = tiers[i];
		const below = tiers[i - 1];
		if (!tier || !below || !interior) continue;
		const added = (tier.indoorItems ?? []).filter(
			(item) => !below.indoorItems?.some((b) => b.id === item.id),
		);
		problems.push(...removeIndoorItems(interior, added));
		problems.push(
			...applyIndoorItemMoves(interior, tier.indoorItemMoves, {
				reverse: true,
			}),
		);
	}

	// Building.LoadFromBuildingData
	raw.buildingType = target.name;
	raw.tilesWide = target.footprint.X;
	raw.tilesHigh = target.footprint.Y;
	if (target.maxOccupants >= 0) raw.maxOccupants = target.maxOccupants;
	raw.hayCapacity = target.hayCapacity;
	raw.humanDoor = { ...(target.humanDoor ?? { X: -1, Y: -1 }) };
	raw.animalDoor = { ...(target.animalDoor ?? { X: -1, Y: -1 }) };
	// AnimalHouse.OnParentBuildingUpgraded
	if (interior?.["@_xsi:type"] === "AnimalHouse")
		interior.animalLimit = target.maxOccupants;
	// The game names a building's interior after the building (Building.createIndoors)
	if (interior) interior.name = target.name;
	return problems;
}
