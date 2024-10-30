import {
    CategoriesWithQuality,
    FishingRodSpriteIndex,
    FishingRodUpgradeNumber,
    FurnitureTypeToNumber,
    ItemData,
    RingsUniqueID,
} from "$lib/ItemData";
import { HexToRGB, RGBToHex } from "$lib/Spritesheet";
import { FurnitureType } from "$types/items/1.5";
import type { ItemInformation, ToolClassName } from "$types/items/1.6";
import { Category } from "$types/save/1.5";
import { ClothesType, type Item } from "$types/save/1.6";

// Mapping of data types to item types
const typeToItemTypeMap = new Map<ItemInformation["_type"], string>([
    ["Object", "Object"],
    ["BigCraftable", "Object"],
    ["Furniture", "Furniture"],
    ["Weapon", "MeleeWeapon"],
    ["Hat", "Hat"],
]);

// Mapping of tool names to tool types
const toolTypeMap = new Map<string, ToolClassName>([
    ["Milk Pail", "MilkPail"],
    ["Pickaxe", "Pickaxe"],
    ["Axe", "Axe"],
    ["Hoe", "Hoe"],
    ["Watering Can", "WateringCan"],
    ["Rod", "FishingRod"],
    ["Pan", "Pan"],
]);

// Mapping of level names to upgrade levels
const upgradeLevels = new Map([
    ["Copper", 1],
    ["Steel", 2],
    ["Gold", 3],
    ["Iridium", 4],
]);

const typeToCategoryMap = {
    Object: undefined,
    BigCraftable: undefined,
    Boots: Category.Boots,
    Pants: Category.Clothing,
    Shirt: Category.Clothing,
    Furniture: Category.Furniture,
    Hat: Category.Hat,
    Weapon: Category.Weapon,
    Tool: Category.Tool,
};

export const createItem = (name: string) => {
    const data = ItemData.get(name);

    if (!data) throw new Error(`Item "${name}" not found in ItemData`);

    // Determine the category
    // Lots of items are missing a category in the data, so we need to handle them separately
    const category =
        "Category" in data ? data.Category : typeToCategoryMap[data._type];

    // Initialize the item
    const item: Item = {
        name: data.Name,
        itemId: data.ItemId,
        stack: 1,
        quality: 0,
        isRecipe: false,
        price: data.Price ?? 0,
        parentSheetIndex:
            "ParentSheetIndex" in data ? data.ParentSheetIndex : undefined,
        indexInTileSheet: "SpriteIndex" in data ? data.SpriteIndex : undefined,
        category: category,
        hasBeenInInventory: true,
        SpecialVariable: 0, // TODO: Verify if needed
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
        type: data._type === "Object" ? data.Type : undefined,
    };

    // Set quality for items that can have quality
    if (category && CategoriesWithQuality.has(category)) {
        item.quality = 0;
    }

    // Set ID for rings
    if (category === Category.Ring) {
        item.uniqueID = RingsUniqueID.get(name);
        // @ts-expect-error
        item["@_xsi:type"] = "Ring";
    }

    // Determine the item type
    let itemType = typeToItemTypeMap.get(data._type);

    // Handle tools separately
    if (data._type === "Tool") {
        const nameWithoutPrefix = name.split(" ").slice(1).join(" ");
        itemType = toolTypeMap.get(nameWithoutPrefix);

        // Special handling for upgrade levels
        if (["Pickaxe", "Axe", "Hoe", "WateringCan"].includes(itemType ?? "")) {
            item.upgradeLevel = 0;
            for (const [levelName, levelValue] of upgradeLevels) {
                if (name.startsWith(levelName)) {
                    item.upgradeLevel = levelValue;
                    // Remove prefix from name
                    item.name = nameWithoutPrefix;
                    break;
                }
            }
        } else if (itemType === "FishingRod") {
            item.upgradeLevel = FishingRodUpgradeNumber.get(data.Name) ?? 0;
            item.parentSheetIndex = 685;
            item.initialParentTileIndex =
                FishingRodSpriteIndex.get(data.Name) ?? 0;
            item.indexOfMenuItemView = item.initialParentTileIndex;
        }
    }

    // Handle weapon properties
    if (data._type === "Weapon") {
        item.minDamage = data.MinDamage;
        item.maxDamage = data.MaxDamage;
        item.speed = data.Speed;
        // item.addedPrecision = data.AddedPrecision;
        // item.addedDefense = data.AddedDefense;
        // item.addedAreaOfEffect = data.AddedAreaOfEffect;
        item.knockback = data.Knockback;
        item.critChance = data.CritChance;
        item.critMultiplier = data.CritMultiplier;
    }

    // Set the xsi:type if itemType is determined
    if (itemType) {
        // This is required for the game to recognize the item as the correct type, but isn't part of the XML structures
        // @ts-expect-error
        item["@_xsi:type"] = itemType;
    }

    // Set parentSheetIndex for non-tools
    if (data._type !== "Tool") {
        item.parentSheetIndex = "SpriteIndex" in data ? data.SpriteIndex : 0;
    }

    // Handle hats
    if (data._type === "Hat") {
        item.which = "";
    }

    // Handle furniture
    if (data._type === "Furniture") {
        item.canBeGrabbed = true;
        item.parentSheetIndex = Number(data.ItemId);
        item.type = FurnitureTypeToNumber.get(data.Type as FurnitureType);

        // Set sourceRect if TilesheetSize is available
        if ("TilesheetSize" in data && data.TilesheetSize !== -1) {
            item.sourceRect = {
                X: data.Sprite.x,
                Y: data.Sprite.y,
                Width: data.TilesheetSize.width,
                Height: data.TilesheetSize.height,
                Location: {
                    X: data.Sprite.x,
                    Y: data.Sprite.y,
                },
                Size: {
                    X: data.TilesheetSize.width,
                    Y: data.TilesheetSize.height,
                },
            };
            item.defaultSourceRect = item.sourceRect;
        }

        // Set boundingBox if BoundingBoxSize is available
        if ("BoundingBoxSize" in data && data.BoundingBoxSize !== -1) {
            item.boundingBox = {
                X: 0,
                Y: 0,
                Width: data.BoundingBoxSize.width,
                Height: data.BoundingBoxSize.height,
                Size: {
                    X: data.BoundingBoxSize.width,
                    Y: data.BoundingBoxSize.height,
                },
                Location: {
                    X: 0,
                    Y: 0,
                },
            };
            item.defaultBoundingBox = item.boundingBox;
        }

        // Enable lamp property for lamp-type furniture
        if (data.Type === FurnitureType.Lamp) {
            item.isLamp = true;
        }
    }

    // Handle dyeable items
    if ("CanBeDyed" in data && data.CanBeDyed) {
        let defaultColor = "#000000";
        if (data.DefaultColor) {
            const [R, G, B] = data.DefaultColor.split(" ").map(Number);
            defaultColor = RGBToHex({
                R: R ?? 0,
                G: G ?? 0,
                B: B ?? 0,
                A: 255,
                PackedValue: 0,
            });
        }
        item.clothesColor = HexToRGB(defaultColor);
    }

    // Set edibility and price if available
    if ("Edibility" in data) {
        item.edibility = data.Edibility;
    }

    if ("Price" in data) {
        item.price = data.Price ?? 0;
    }

    // Handle clothes types
    if (data._type in ClothesType) {
        item.clothesType = ClothesType[data._type as keyof typeof ClothesType];
    }

    // TODO: Handle the Copper Pan hat special case if needed

    return item;
};
