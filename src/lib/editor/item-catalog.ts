import { immutableView } from "./immutable-view.ts";
import { readItemVisual, type ItemVisual } from "./item-presentation.ts";
import {
	FurnitureTypeToNumber,
	ItemData,
	ItemDescription,
	RingsUniqueID,
} from "../ItemData.ts";
import { Sprite } from "../Sprite.svelte.ts";
import type { ItemInformation } from "$types/items";

/** One catalog choice. Its ID distinguishes flavored variants sharing a game ID. */
export interface CatalogEntry {
	readonly id: string;
	readonly name: string;
	readonly qualifiedId: string;
	readonly kind: string;
	readonly description: string;
	readonly raw: Record<string, unknown>;
}

/** Picker-ready catalog metadata. Item construction stays private to the domain;
 * visual instructions are resolved only for choices the UI actually displays. */
export interface CatalogChoice extends Omit<CatalogEntry, "raw"> {
	readonly visual?: ItemVisual;
}

const prefixes: Record<ItemInformation["_type"], string> = {
	Object: "O",
	BigCraftable: "BC",
	Boots: "B",
	Furniture: "F",
	Hat: "H",
	Mannequin: "M",
	Pants: "P",
	Shirt: "S",
	Tool: "T",
	Trinket: "TR",
	Weapon: "W",
};
const categories: Partial<Record<ItemInformation["_type"], number>> = {
	BigCraftable: -9,
	Boots: -97,
	Pants: -100,
	Shirt: -100,
	Furniture: -24,
	Hat: -95,
	Weapon: -98,
	Tool: -99,
	Trinket: -101,
	Mannequin: -24,
};
const saveTypes: Partial<Record<ItemInformation["_type"], string>> = {
	Object: "Object",
	BigCraftable: "Object",
	Furniture: "Furniture",
	Weapon: "MeleeWeapon",
	Hat: "Hat",
	Shirt: "Clothing",
	Pants: "Clothing",
	Boots: "Boots",
	Trinket: "Trinket",
	Mannequin: "Mannequin",
};
const preserves: Record<string, string> = {
	Pickles: "Pickle",
	"Aged Roe": "AgedRoe",
	Smoked: "SmokedFish",
	Wine: "Wine",
	Jelly: "Jelly",
	Juice: "Juice",
	Roe: "Roe",
	Honey: "Honey",
	Bait: "Bait",
};

// Construction applies only to new records from trusted generated metadata. Never
// run imported items through this factory: their opaque fields remain authoritative.
function color(value: string) {
	const channels = value.startsWith("#")
		? [
				value.slice(1, 3),
				value.slice(3, 5),
				value.slice(5, 7),
				value.slice(7, 9) || "ff",
			].map((part) => Number.parseInt(part, 16))
		: value
				.replace(/^rgb\(|\)$/g, "")
				.split(/[ ,]+/)
				.map(Number);
	const [R = 0, G = 0, B = 0, A = 255] = channels;
	return {
		B,
		G,
		R,
		A,
		PackedValue: ((A << 24) | (B << 16) | (G << 8) | R) >>> 0,
	};
}
function rectangle(x: number, y: number, width: number, height: number) {
	return {
		X: x,
		Y: y,
		Width: width,
		Height: height,
		Size: { X: width, Y: height },
		Location: { X: x, Y: y },
	};
}

// These catalog families need specialized serialized subclasses or game defaults
// beyond this factory. Do not silently create a base Object/Furniture stand-in.
const specializedObjects = new Set(["93", "710", "880"]); // Torch, Crab Pot, Combined Ring.
const specializedCraftables = new Set([
	// Signs and indoor planting carry their own specialized saved state.
	"37",
	"38",
	"39",
	"TextSign",
	"62",
	// Lit torches/braziers and campfires are not generic machine records.
	"72",
	"74",
	"143",
	"144",
	"145",
	"146",
	"147",
	"148",
	"149",
	"150",
	"151",
	"152",
	"153",
	"278",
	// Storage variants include refrigerators, shipping bins and auto-loaders.
	"130",
	"216",
	"232",
	"248",
	"256",
	"275",
	"BigChest",
	"BigStoneChest",
	// Casks, workbenches, mini-jukeboxes and item pedestals need subclass defaults.
	"163",
	"208",
	"209",
	"221",
]);
function supportsConstruction(data: ItemInformation) {
	if (data._type === "Object") return !specializedObjects.has(data._key);
	if (data._type === "BigCraftable")
		return !specializedCraftables.has(data._key);
	if (data._type === "Tool")
		return data.class !== "GenericTool" && data.class !== "Lantern";
	if (data._type === "Weapon") return data._key !== "32" && data._key !== "33"; // Slingshots require attachments.
	if (data._type === "Furniture") {
		return (
			![
				"dresser",
				"fishtank",
				"bed",
				"bed double",
				"bed child",
				"randomized_plant",
			].includes(data.type) &&
			data.tilesheetSize !== undefined &&
			data.boundingBoxSize !== undefined
		);
	}
	return true;
}

function construct(
	name: string,
	data: ItemInformation,
): Record<string, unknown> | undefined {
	if (!supportsConstruction(data)) return undefined;
	const item: Record<string, unknown> = {
		"@_xsi:type": saveTypes[data._type],
		name: data.name,
		itemId: data._key,
		stack: 1,
		quality: 0,
		isRecipe: false,
		price: data.price ?? 0,
		parentSheetIndex: data.spriteIndex ?? undefined,
		indexInTileSheet: data.spriteIndex ?? undefined,
		category: "category" in data ? data.category : categories[data._type],
		hasBeenInInventory: true,
		SpecialVariable: 0,
		isLostItem: false,
		specialItem: false,
		tileLocation: { X: 0, Y: 0 },
		boundingBox: rectangle(0, 0, 64, 64),
		canBeSetDown: true,
		canBeGrabbed: true,
		bigCraftable: data._type === "BigCraftable",
	};
	// Each family contributes its actual saved representation rather than inheriting
	// proxy initialization effects or depending on a mounted component/effect root.
	if (data._type === "Object") item.type = data.type;
	if (data._type === "BigCraftable") item.type = "Crafting";
	if (data._type === "Tool") {
		// Metadata owns the tool class and level. Name suffixes confuse shop-only
		// Trash Can upgrades with WateringCan, and old rod maps omit advanced rods.
		item["@_xsi:type"] = data.class;
		item.upgradeLevel = data.upgradeLevel ?? 0;
		item.numAttachmentSlots = data.attachmentSlots ?? 0;
		const menuIndex =
			data.menuSpriteIndex != null && data.menuSpriteIndex >= 0
				? data.menuSpriteIndex
				: data.spriteIndex;
		item.initialParentTileIndex = data.spriteIndex;
		item.currentParentTileIndex = data.spriteIndex;
		item.indexOfMenuItemView = menuIndex;
		if (data.class === "FishingRod") {
			// The game's rod representation retains two empty attachment positions
			// even for Bamboo; advanced rods extend that list to three positions.
			item.attachments = {
				Object: Array.from(
					{ length: Math.max(2, data.attachmentSlots ?? 0) },
					() => ({ "@_xsi:nil": "true" }),
				),
			};
		}
		if (data.class === "WateringCan") {
			item.IsBottomless = false;
			item.isBottomless = false;
		}
	}
	// The game persists weapon and boots stats on each instance. Seed those
	// explicit fields from metadata instead of depending on proxy construction.
	if (data._type === "Weapon") {
		Object.assign(item, {
			minDamage: data.minDamage,
			maxDamage: data.maxDamage,
			speed: data.speed,
			addedPrecision: data.precision,
			addedDefense: data.defense,
			addedAreaOfEffect: data.areaOfEffect,
			knockback: data.knockback,
			critChance: data.critChance,
			critMultiplier: data.critMultiplier,
		});
	}
	// Preview seeds are deterministic. The committed fresh trinket receives a seed
	// only at creation, so browsing does not generate or mutate an item instance.
	if (data._type === "Trinket") item.generationSeed = 0;
	if (data._type === "Object" && data.type === "Ring") {
		item["@_xsi:type"] = "Ring";
		item.uniqueID = RingsUniqueID.get(name);
	}
	// Preserve the legacy new-hat representation and its hair-rendering flags;
	// none of these defaults are applied to existing imported hats.
	if (data._type === "Hat")
		Object.assign(item, {
			which: { "@_xsi:nil": "true" },
			skipHairDraw: data.showRealHair,
			ignoreHairstyleOffset: data.skipHairstyleOffset,
		});
	if (data._type === "Furniture") {
		// Furniture stores a numeric subtype separately from Object.type. New
		// records materialize tile geometry at the game's 64-pixel world scale.
		item.furniture_type = FurnitureTypeToNumber.get(data.type);
		item.rotations = data.rotations ?? 1;
		item.currentRotation = 0;
		item.sourceIndexOffset = 0;
		item.drawPosition = { X: 0, Y: 0 };
		const sprite = new Sprite(data);
		if (data.tilesheetSize) {
			item.sourceRect = rectangle(
				sprite.sourceRect.x,
				sprite.sourceRect.y,
				data.tilesheetSize.width * 16,
				data.tilesheetSize.height * 16,
			);
			item.defaultSourceRect = structuredClone(item.sourceRect);
		}
		if (data.boundingBoxSize) {
			item.boundingBox = rectangle(
				0,
				0,
				data.boundingBoxSize.width * 64,
				data.boundingBoxSize.height * 64,
			);
			item.defaultBoundingBox = structuredClone(item.boundingBox);
		}
		if (data.type === "lamp") item.isLamp = true;
	}
	if ("canBeDyed" in data && data.canBeDyed)
		item.clothesColor = color("#FFFFFF");
	if ("edibility" in data) item.edibility = data.edibility;
	if (data._type === "Shirt" || data._type === "Pants")
		item.clothesType = data._type.toUpperCase();
	if (data._type === "Boots")
		Object.assign(item, {
			defenseBonus: data.defense,
			immunityBonus: data.immunity,
			indexInColorSheet: data.colorIndex,
		});
	if (
		"unpreservedItemId" in data &&
		data.unpreservedItemId &&
		data.preservedItemName
	) {
		// Version 1.6 ingredients also have string IDs such as Goby and Carrot.
		// Keep numeric legacy IDs numeric while preserving these string IDs.
		item.preservedParentSheetIndex = /^\d+$/.test(data.unpreservedItemId)
			? Number(data.unpreservedItemId)
			: data.unpreservedItemId;
		item.preserve =
			data.preservedItemName === "Dried"
				? data._key === "DriedMushrooms"
					? "DriedMushroom"
					: "DriedFruit"
				: preserves[data.preservedItemName];
	}
	if (data.color) {
		item.color = color(data.color);
		if (data._type === "Object") item["@_xsi:type"] = "ColoredObject";
	}
	if (!item["@_xsi:type"]) return undefined;
	// Generated metadata has optional fields. Omit those absent defaults deliberately;
	// unlike imported saves, these new records contain no opaque data to preserve.
	return JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
}

/** Available new item records, loaded with Inventory rather than session startup. */
export const catalogEntries: readonly CatalogEntry[] = [...ItemData].flatMap(
	([id, data]) => {
		const raw = construct(id, data);
		return raw
			? [
					{
						id,
						// Keys include readable flavored variants; displayName may
						// still contain unresolved localization tokens.
						name: id,
						qualifiedId: `(${prefixes[data._type]})${data._key}`,
						kind: data._type,
						description: ItemDescription(data) ?? "",
						raw,
					},
				]
			: [];
	},
);
// Browsing a catalog needs no serialized item template. Keep the existing
// factory entries behind this projection and resolve sprites lazily so opening
// the editor does not eagerly construct drawings for every catalog variant.
export const catalogChoices: readonly CatalogChoice[] = Object.freeze(
	catalogEntries.map((entry) =>
		Object.freeze({
			id: entry.id,
			name: entry.name,
			qualifiedId: entry.qualifiedId,
			kind: entry.kind,
			description: entry.description,
			get visual() {
				return immutableView(readItemVisual(entry.raw));
			},
		}),
	),
);
const entriesById = new Map(catalogEntries.map((entry) => [entry.id, entry]));

/** Create a detached item from an exact catalog choice; callers cannot supply raw XML. */
export function createCatalogItem(
	id: string,
): Record<string, unknown> | undefined {
	const entry = entriesById.get(id);
	if (!entry) return undefined;
	// Reconstruct from trusted metadata instead of UI-exposed previews: even a caller
	// mutating a preview cannot introduce arbitrary fields into a newly placed item.
	const data = ItemData.get(id);
	if (!data) return undefined;
	const raw = construct(id, data);
	if (raw && entry.kind === "Trinket")
		raw.generationSeed = Math.floor(Math.random() * 9999999);
	return raw;
}

/** Match names and qualified/unqualified IDs; exact matches precede broad browsing. */
export function searchCatalog(
	query: string,
	kind = "all",
	entries: readonly CatalogChoice[] = catalogChoices,
): readonly CatalogChoice[] {
	const search = query.trim().toLowerCase();
	return entries
		.filter(
			(entry) =>
				(kind === "all" || entry.kind === kind) &&
				(!search ||
					entry.name.toLowerCase().includes(search) ||
					entry.id.toLowerCase().includes(search) ||
					entry.qualifiedId.toLowerCase() === search ||
					entry.qualifiedId.replace(/^\([^)]*\)/, "").toLowerCase() === search),
		)
		.sort((a, b) => {
			const rank = (entry: CatalogChoice) =>
				entry.qualifiedId.toLowerCase() === search ||
				entry.qualifiedId.replace(/^\([^)]*\)/, "").toLowerCase() === search ||
				entry.name.toLowerCase() === search ||
				entry.id.toLowerCase() === search
					? 0
					: entry.name.toLowerCase().startsWith(search)
						? 1
						: 2;
			return (
				rank(a) - rank(b) ||
				a.name.localeCompare(b.name) ||
				a.id.localeCompare(b.id)
			);
		});
}
