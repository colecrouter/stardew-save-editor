import {
	CategoriesWithQuality,
	FishingRodSpriteIndex,
	FishingRodUpgradeNumber,
	FurnitureTypeToNumber,
	ItemData,
	KeyToName,
	RingsUniqueID,
	Shirts,
} from "$lib/ItemData";
import type { ParentIndex } from "$lib/ItemParentIndex";
import { Color } from "$lib/proxies/Color.svelte";
import { Sprite } from "$lib/Sprite.svelte";
import type { PreserveLabel } from "$types/helpers";
import {
	FurnitureType,
	type ItemInformation,
	ObjectCategory,
	type ToolClass,
} from "$types/items";
import {
	ClothesType,
	type Item as ItemModel,
	Preserve,
	TypeEnum,
} from "$types/save";
import { Dispose } from ".";
import {
	BootsProxy,
	ClothingProxy,
	createItemProxy,
	HatProxy,
	type ItemProxy,
	RingProxy,
	TrinketProxy,
} from "./items";

const nil = { "@_xsi:nil": "true" };

function normalizePreserveType(
	label: PreserveLabel,
	outputItemId: string,
): Preserve {
	switch (label) {
		case "Pickles":
			return Preserve.Pickle;
		case "Aged Roe":
			return Preserve.AgedRoe;
		case "Smoked":
			return Preserve.SmokedFish;
		case "Dried":
			return outputItemId === "DriedMushrooms"
				? Preserve.DriedMushroom
				: Preserve.DriedFruit;
		case "Wine":
			return Preserve.Wine;
		case "Jelly":
			return Preserve.Jelly;
		case "Juice":
			return Preserve.Juice;
		case "Roe":
			return Preserve.Roe;
		case "Honey":
			return Preserve.Honey;
		case "Bait":
			return Preserve.Bait;
		default:
			throw new Error(`Unknown preserve type: ${label}`);
	}
}

const typeToItemTypeMap = new Map<ItemInformation["_type"], string>([
	["Object", "Object"],
	["BigCraftable", "Object"],
	["Furniture", "Furniture"],
	["Weapon", "MeleeWeapon"],
	["Hat", "Hat"],
	["Shirt", "Clothing"],
	["Pants", "Clothing"],
	["Boots", "Boots"],
	["Trinket", "Trinket"],
	["Mannequin", "Mannequin"],
]);

const toolTypeMap = new Map<string, ToolClass>([
	["Pail", "MilkPail"],
	["Pickaxe", "Pickaxe"],
	["Axe", "Axe"],
	["Hoe", "Hoe"],
	["Can", "WateringCan"],
	["Rod", "FishingRod"],
	["Pan", "Pan"],
	["Wand", "Wand"],
]);

const toolNameMap = new Map<string, string>([
	["Can", "Watering Can"],
	["Rod", "Fishing Rod"],
	["Pan", "Copper Pan"],
]);

const upgradeLevels = new Map([
	["Copper", 1],
	["Steel", 2],
	["Gold", 3],
	["Iridium", 4],
]);

const typeToCategoryMap = {
	Object: undefined,
	BigCraftable: ObjectCategory.BigCraftable,
	Boots: ObjectCategory.Boots,
	Pants: ObjectCategory.Clothing,
	Shirt: ObjectCategory.Clothing,
	Furniture: ObjectCategory.Furniture,
	Hat: ObjectCategory.Hat,
	Weapon: ObjectCategory.Weapon,
	Tool: ObjectCategory.Tool,
	Trinket: ObjectCategory.Trinket,
	Mannequin: ObjectCategory.Furniture,
};

export class Item {
	static create(raw: ItemModel): ItemProxy {
		let instance!: ItemProxy;
		const dispose = $effect.root(() => {
			instance = createItemProxy(raw);
		});
		instance[Dispose] = dispose;
		return instance;
	}

	// TODO refactor all of this
	static fromName(name: string): ItemProxy {
		let data = ItemData.get(name);
		if (!data) {
			data = Shirts.get(name);
		}

		if (!data) throw new Error(`Item "${name}" not found in ItemData`);

		const category =
			"category" in data ? data.category : typeToCategoryMap[data._type];

		const item: ItemModel = {
			"@_xsi:type": "",
			name: data.name,
			itemId: data._key,
			stack: 1,
			quality: 0,
			isRecipe: false,
			price: data.price ?? 0,
			parentSheetIndex: data.spriteIndex || undefined,
			indexInTileSheet: data.spriteIndex || undefined,
			category: category,
			hasBeenInInventory: true,
			SpecialVariable: 0,
			isLostItem: false,
			specialItem: false,
			tileLocation: { X: 0, Y: 0 },
			boundingBox: {
				X: 0,
				Y: 0,
				Width: 64,
				Height: 64,
				Size: { X: 64, Y: 64 },
				Location: { X: 0, Y: 0 },
			},
			canBeSetDown: true,
			canBeGrabbed: true,
			type:
				data._type === "Object"
					? data.type
					: data._type === "BigCraftable"
						? "Crafting"
						: undefined,
			bigCraftable: data._type === "BigCraftable" ? true : undefined,
		};

		if (category && CategoriesWithQuality.has(category)) {
			item.quality = 0;
		}

		let itemType = typeToItemTypeMap.get(data._type);

		if (data._type === "Tool") {
			const nameWithoutPrefix = name.split(" ").pop() ?? name;
			itemType = toolTypeMap.get(nameWithoutPrefix);
			if (
				itemType &&
				["Pickaxe", "Axe", "Hoe", "WateringCan"].includes(itemType)
			) {
				item.upgradeLevel = 0;
				for (const [levelName, levelValue] of upgradeLevels) {
					if (name.startsWith(levelName)) {
						item.upgradeLevel = levelValue;
						item.name = toolNameMap.get(nameWithoutPrefix) ?? nameWithoutPrefix;
						break;
					}
				}
				item.indexOfMenuItemView = data.menuSpriteIndex;
			}

			if (itemType === "FishingRod") {
				item.upgradeLevel = FishingRodUpgradeNumber.get(data.name) ?? 0;
				item.parentSheetIndex = 685;
				item.initialParentTileIndex = FishingRodSpriteIndex.get(data.name) ?? 0;
				item.indexOfMenuItemView = item.initialParentTileIndex;
			}

			if (itemType === "WateringCan") {
				item.IsBottomless = false;
				item.isBottomless = false;
			}

			if (!itemType) itemType = toolTypeMap.get(data.class);
		}

		if (data._type === "Weapon") {
			item.minDamage = data.minDamage;
			item.maxDamage = data.maxDamage;
			item.speed = data.speed;
			item.addedPrecision = data.precision;
			item.addedDefense = data.defense;
			item.addedAreaOfEffect = data.areaOfEffect;
			item.knockback = data.knockback;
			item.critChance = data.critChance;
			item.critMultiplier = data.critMultiplier;
		}

		if (data._type === "Trinket") {
			item.generationSeed = Math.floor(Math.random() * 9999999);
		}

		if (itemType) {
			item["@_xsi:type"] = itemType;
		}

		if (data._type === "Object" && data.type === TypeEnum.Ring) {
			item.uniqueID = RingsUniqueID.get(name);
			item["@_xsi:type"] = "Ring";
		}

		if (data._type === "Hat") {
			// @ts-expect-error TODO revisit this
			item.which = nil;
			item.skipHairDraw = data.showRealHair;
			item.ignoreHairstyleOffset = data.skipHairstyleOffset;
		}

		if (data._type === "Furniture") {
			item.canBeGrabbed = true;
			item.type = FurnitureTypeToNumber.get(data.type as FurnitureType);

			const sprite = new Sprite(data);
			if ("tilesheetSize" in data && data.tilesheetSize !== undefined) {
				const invertedX = sprite.sheetSize.width - sprite.dimensions.x;
				const invertedY = sprite.sheetSize.height - sprite.dimensions.y;
				item.sourceRect = {
					X: invertedX,
					Y: invertedY,
					Width: data.tilesheetSize.width * 16,
					Height: data.tilesheetSize.height * 16,
					Location: {
						X: invertedX,
						Y: invertedY,
					},
					Size: {
						X: data.tilesheetSize.width * 16,
						Y: data.tilesheetSize.height * 16,
					},
				};
				item.defaultSourceRect = item.sourceRect;
			}

			if ("boundingBoxSize" in data && data.boundingBoxSize !== undefined) {
				item.boundingBox = {
					X: 0,
					Y: 0,
					Width: data.boundingBoxSize.width,
					Height: data.boundingBoxSize.height,
					Size: {
						X: data.boundingBoxSize.width,
						Y: data.boundingBoxSize.height,
					},
					Location: {
						X: 0,
						Y: 0,
					},
				};
				item.defaultBoundingBox = item.boundingBox;
			}

			if (data.type === FurnitureType.Lamp) {
				item.isLamp = true;
			}
		}

		if ("canBeDyed" in data && data.canBeDyed) {
			const defaultColor = new Color("#FFFFFF");
			item.clothesColor = defaultColor;
		}

		if ("edibility" in data) {
			item.edibility = data.edibility;
		}
		item.price = data.price ?? 0;

		if (data._type in ClothesType) {
			item.clothesType = ClothesType[data._type as keyof typeof ClothesType];
		}
		if (data._type === "Boots") {
			item.indexInColorSheet = data.colorIndex;
		}

		if (
			"unpreservedItemId" in data &&
			data.unpreservedItemId &&
			data.preservedItemName
		) {
			item.preservedParentSheetIndex = Number.parseInt(
				data.unpreservedItemId,
				10,
			);

			item.preserve = normalizePreserveType(data.preservedItemName, data._key);
		}

		if (data.color) {
			item.color = new Color(data.color);

			if (data._type === "Object") {
				item["@_xsi:type"] = "ColoredObject";
			}
		}

		// Use Item.create() which now delegates to the factory function
		return Item.create(item as ItemModel);
	}

	static fromKey(key: string, type: string): ItemProxy {
		console.log(key, type, KeyToName(key, type));
		const name = KeyToName(key, type);

		return Item.fromName(name);
	}
}

export const ValidSlotForItem = (item: ItemProxy, slot: ParentIndex) => {
	if (typeof slot === "number") return true;

	const info = item.info;

	if (HatProxy.isSlotCompatible(slot) && info?._type === "Hat") return true;
	if (BootsProxy.isSlotCompatible(slot) && info?._type === "Boots") return true;
	if (
		ClothingProxy.isSlotCompatible(slot) &&
		(info?._type === "Shirt" || info?._type === "Pants")
	)
		return true;
	if (
		RingProxy.isSlotCompatible(slot) &&
		info?._type === "Object" &&
		info.type === TypeEnum.Ring
	)
		return true;
	if (TrinketProxy.isSlotCompatible(slot) && info?._type === "Trinket")
		return true;

	return false;
};
