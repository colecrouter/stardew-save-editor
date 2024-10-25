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
import { Category } from "$types/save/1.5";
import { ClothesType, type Item } from "$types/save/1.6";

export const createItem = (name: string) => {
    const data = ItemData.get(name);

    if (!data) {
        throw new Error(`Item "${name}" not found in ItemData`);
    }

    let category: number | undefined;
    switch (data._type) {
        case "Object":
            break;
        case "BigCraftable":
            break;
        case "Boots":
            category = Category.Boots;
            break;
        case "Pants":
        case "Shirt":
            category = Category.Clothing;
            break;
        case "Furniture":
            category = Category.Furniture;
            break;
        case "Hat":
            category = Category.Hat;
            break;
        case "Weapon":
            category = Category.Weapon;
            break;
        case "Tool":
            category = Category.Tool;
            break;
    }

    const item: Item = {
        name,
        itemId: data.ItemId,
        stack: 1,
        quality: 0,
        isRecipe: false,
        price: data.Price ?? 0,
        parentSheetIndex:
            "ParentSheetIndex" in data ? data.ParentSheetIndex : undefined,
        indexInTileSheet: "SpriteIndex" in data ? data.SpriteIndex : undefined,
        category: 'Category' in data ? data.Category : undefined,
        hasBeenInInventory: true,
        SpecialVariable: 0, // TODO ?
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
        type: (data._type === 'Object') ? data.Type : undefined,
    };

    let type: string | undefined;
    switch (data._type) {
        case "Object":
        case "BigCraftable":
            type = "Object";
            break;
        case "Furniture":
            type = "Furniture";
            break;
        case "Weapon":
            type = "MeleeWeapon";
            break;
        case "Tool":
            if (name === "Milk Pail") {
                type = "MilkPail";
            } else if (name.endsWith("Pickaxe")) {
                type = "Pickaxe";
            } else if (name.endsWith("Axe")) {
                type = "Axe";
            } else if (name.endsWith("Hoe")) {
                type = "Hoe";
            } else if (name.endsWith("Watering Can")) {
                type = "WateringCan";
            } else if (name.endsWith("Rod")) {
                type = "FishingRod";
            } else if (name.endsWith("Pan")) {
                type = "Pan";
            }
            break;
        case "Hat":
            type = "Hat";
            break;
        // TODO
    }

    if (type) {
        // This is required for the game to recognize the item as the correct type, but isn't part of the XML structures
        // @ts-expect-error
        item["@_xsi:type"] = type;

        // TODO: copper pan hat
        // if (symbol === 'hat' && name === 'Copper Pan') {
        //   // @ts-expect-error
        //   item['@_xsi:type'] = 'Hat';
        // }
    }

    // Add item quality if applicable
    if ('Category' in data && CategoriesWithQuality.has(data.Category)) {
        item.quality = 0;

        // Special case for rings
        if (data.Category === Category.Ring) {
            const id = RingsUniqueID.get(name);
            if (id) {
                item.uniqueID = id;
            }
        }
    }

    if (data._type !== "Tool") {
        item.parentSheetIndex = "SpriteIndex" in data ? data.SpriteIndex : 0;
    }

    if (item.name === "Fishing Rod") {
        item.upgradeLevel = FishingRodUpgradeNumber.get(data.Name) ?? 0;
        item.parentSheetIndex = 685;
        item.initialParentTileIndex = FishingRodSpriteIndex.get(data.Name) ?? 0;
        item.indexOfMenuItemView = item.initialParentTileIndex;
    }

    if (data._type === "Hat") {
        item.which = "";
    }

    if ("Type" in data && data._type === "Furniture") {
        item.canBeGrabbed = true;
        item.parentSheetIndex = Number(data.ItemId);
        item.type = FurnitureTypeToNumber.get(data.Type as FurnitureType);

        // sourceRect is the sprite data, if I understand correctly
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

        // Bounding box is the hitbox/placement box
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

        // If the item is a lamp, enable the lamp property
        if (data.Type === FurnitureType.Lamp) {
            item.isLamp = true;
        }
    }

    if ("CanBeDyed" in data && data.CanBeDyed) {
        let defaultColor = "#000000";
        if ("DefaultColor" in data && data.DefaultColor) {
            const [R, G, B] = data.DefaultColor.split(" ").map(Number);
            const A = 255;
            defaultColor = RGBToHex({ R, G, B, A, PackedValue: 0 });
        }

        item.clothesColor = HexToRGB(defaultColor);
    }

    if ('Category' in data && data.Category === Category.Ring) {
        // @ts-expect-error
        item["@_xsi:type"] = "Ring";
    }

    if ("Edibility" in data) {
        item.edibility = data.Edibility;
    }

    if ("Price" in data) {
        item.price = data.Price ?? 0;
    }

    if (data._type === "Shirt") {
        item.clothesType = ClothesType.Shirt;
    } else if (data._type === "Pants") {
        item.clothesType = ClothesType.Pants;
    }

    // TODO: copper pan hat
    // if (symbol === 'hat' && item.name === 'Copper Pan') {
    //     // @ts-expect-error This is exlusive to the copper pan
    //     item.ignoreHairstyleOffset = true;
    //     item.parentSheetIndex = 71;
    //     item.indexInTileSheet = 71;
    //     item.category = Category.Hat;
    //     // @ts-expect-error This is exlusive to the copper pan
    //     item.which = 71;
    // }

    return item;
};
