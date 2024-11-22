import {
    CategoriesWithQuality,
    FishingRodSpriteIndex,
    FishingRodUpgradeNumber,
    FurnitureTypeToNumber,
    ItemData,
    ItemNameHelper,
    RingsUniqueID,
} from "$lib/ItemData";
import { Color } from "$lib/proxies/Color";
import {
    FurnitureType,
    type ItemInformation,
    type ToolClassName,
} from "$types/items/1.6";
import { Category } from "$types/save/1.5";
import { ClothesType, type Item as ItemModel } from "$types/save/1.6";

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
    BigCraftable: Category.BigCraftable,
    Boots: Category.Boots,
    Pants: Category.Clothing,
    Shirt: Category.Clothing,
    Furniture: Category.Furniture,
    Hat: Category.Hat,
    Weapon: Category.Weapon,
    Tool: Category.Tool,
};

export class Item {
    raw: ItemModel;
    info: ItemInformation;

    constructor(raw: ItemModel) {
        this.raw = raw;
        const info = ItemData.get(ItemNameHelper(raw));
        if (!info) throw new Error(`Item "${raw.name}" not found in ItemData`);
        this.info = info;
    }

    static fromName(name: string): Item {
        const data = ItemData.get(name);

        if (!data) throw new Error(`Item "${name}" not found in ItemData`);

        // Determine the category
        // Lots of items are missing a category in the data, so we need to handle them separately
        const category =
            "Category" in data ? data.Category : typeToCategoryMap[data._type];

        // Initialize the item
        const item: ItemModel = {
            name: data.Name,
            itemId: data.ItemId,
            stack: 1,
            quality: 0,
            isRecipe: false,
            price: data.Price ?? 0,
            parentSheetIndex:
                "ParentSheetIndex" in data ? data.ParentSheetIndex : undefined,
            indexInTileSheet:
                "SpriteIndex" in data ? data.SpriteIndex : undefined,
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
            // @ts-expect-error TODO fix later
            type:
                data._type === "Object"
                    ? data.Type
                    : data._type === "BigCraftable"
                      ? "Crafting"
                      : undefined,
            bigCraftable: data._type === "BigCraftable" ? true : undefined,
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
            if (
                ["Pickaxe", "Axe", "Hoe", "WateringCan"].includes(
                    itemType ?? "",
                )
            ) {
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
            item.parentSheetIndex =
                "SpriteIndex" in data ? data.SpriteIndex : 0;
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
            let defaultColor = new Color("#FFFFFF");
            if (data.DefaultColor) {
                const [R, G, B] = data.DefaultColor.split(" ").map(Number);
                if (!R || !G || !B)
                    throw new Error(`Invalid color for item "${name}"`);
                defaultColor = new Color({ R, G, B });
            }
            item.clothesColor = defaultColor;
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
            item.clothesType =
                ClothesType[data._type as keyof typeof ClothesType];
            if (data._type === "Boots") {
                item.indexInColorSheet = data.ColorIndex;
            }
        }

        // TODO: Handle the Copper Pan hat special case if needed

        return new Item(item);
    }

    get name(): string {
        return ItemNameHelper(this.raw);
    }

    get id() {
        return this.raw.itemId.toString();
    }

    get type() {
        return this.info._type;
    }

    get amount() {
        // TODO: Since 1.6 removed stackable field, not sure how to actually know
        if (
            [
                "Clothing",
                "Boots",
                "Hat",
                "Weapon",
                "Pants",
                "Shirt",
                "Tool",
            ].includes(this.info._type)
        )
            return undefined;
        return this.raw.stack;
    }

    set amount(amount) {
        if (this.amount === undefined)
            throw new Error("Amount is not applicable to this item");
        if (amount === undefined || amount < 1 || amount > 999)
            throw new Error("Amount must be between 1 and 999");

        this.raw.stack = amount;
    }

    get quality() {
        if (!this.raw.category) return undefined;
        if (!CategoriesWithQuality.has(this.raw.category)) return undefined;

        return this.raw.quality;
    }

    set quality(quality) {
        if (this.quality === undefined) throw new Error("Item has no quality");
        if (!quality) throw new Error("Quality must be a number");

        if (quality < 0 || quality > 4)
            throw new Error("Quality must be between 0 and 4");

        this.raw.quality = quality;
    }

    get edibility() {
        if (!("edibility" in this.raw) || this.raw.edibility === -300)
            return undefined;

        return this.raw.edibility;
    }

    set edibility(edibility) {
        if (this.edibility === undefined)
            throw new Error("Item has no edibility");

        this.raw.edibility = edibility;
    }

    get price() {
        if (
            ![
                "Object",
                "BigCraftable",
                "Furniture",
                "Hat",
                "Clothing",
            ].includes(this.info._type)
        )
            return undefined;

        return this.raw.price;
    }

    set price(price) {
        if (this.price === undefined)
            throw new Error("Price is not applicable to this item");

        if (price === undefined || price < 0 || price > 99999)
            throw new Error("Price must be between 0 and 99999");

        this.raw.price = price;
    }

    get color() {
        if (
            !("CanBeDyed" in this.info) ||
            !this.info.CanBeDyed ||
            !this.raw.clothesColor
        )
            return undefined;

        return new Color(this.raw.clothesColor);
    }

    set color(color) {
        if (this.color === undefined)
            throw new Error("Color is not applicable to this item");

        if (color === undefined) throw new Error("Color must be a string");

        this.raw.clothesColor = color;
    }

    get category() {
        return this.raw.category;
    }

    get minDamage() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.minDamage;
    }

    set minDamage(minDamage) {
        if (this.minDamage === undefined)
            throw new Error("Item is not a weapon");

        if (minDamage === undefined || minDamage < 0 || minDamage > 999)
            throw new Error("Min damage must be between 0 and 999");

        this.raw.minDamage = minDamage;
    }

    get maxDamage() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.maxDamage;
    }

    set maxDamage(maxDamage) {
        if (this.maxDamage === undefined)
            throw new Error("Item is not a weapon");

        if (maxDamage === undefined || maxDamage < 0 || maxDamage > 999)
            throw new Error("Max damage must be between 0 and 999");

        this.raw.maxDamage = maxDamage;
    }

    get speed() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.speed;
    }

    set speed(speed) {
        if (this.speed === undefined) throw new Error("Item is not a weapon");

        if (speed === undefined || speed < 0 || speed > 999)
            throw new Error("Speed must be between 0 and 999");

        this.raw.speed = speed;
    }

    get knockback() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.knockback;
    }

    set knockback(knockback) {
        if (this.knockback === undefined)
            throw new Error("Item is not a weapon");

        if (knockback === undefined || knockback < 0 || knockback > 999)
            throw new Error("Knockback must be between 0 and 999");

        this.raw.knockback = knockback;
    }

    get critChance() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.critChance;
    }

    set critChance(critChance) {
        if (this.critChance === undefined)
            throw new Error("Item is not a weapon");

        if (critChance === undefined || critChance < 0 || critChance > 1)
            throw new Error("Crit chance must be between 0 and 1");

        this.raw.critChance = critChance;
    }

    get critMultiplier() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.critMultiplier;
    }

    set critMultiplier(critMultiplier) {
        if (this.critMultiplier === undefined)
            throw new Error("Item is not a weapon");

        if (critMultiplier === undefined || critMultiplier < 0)
            throw new Error("Crit multiplier must be at least 0");

        this.raw.critMultiplier = critMultiplier;
    }

    get precision() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.addedPrecision;
    }

    set precision(precision) {
        if (this.precision === undefined)
            throw new Error("Item is not a weapon");

        if (precision === undefined || precision < 0 || precision > 999)
            throw new Error("Precision must be between 0 and 999");

        this.raw.addedPrecision = precision;
    }

    get areaOfEffect() {
        if (this.info._type !== "Weapon") return undefined;

        return this.raw.addedAreaOfEffect;
    }

    set areaOfEffect(areaOfEffect) {
        if (this.areaOfEffect === undefined)
            throw new Error("Item is not a weapon");

        if (
            areaOfEffect === undefined ||
            areaOfEffect < 0 ||
            areaOfEffect > 999
        )
            throw new Error("Area of effect must be between 0 and 999");

        this.raw.addedAreaOfEffect = areaOfEffect;
    }

    get defense() {
        if (!["Boots", "Weapon"].includes(this.info._type)) return undefined;

        return this.raw.addedDefense;
    }

    set defense(defense) {
        if (this.defense === undefined)
            throw new Error("Item is not a weapon or boots");

        if (defense === undefined || defense < 0 || defense > 999)
            throw new Error("Defense must be between 0 and 999");

        this.raw.addedDefense = defense;
    }

    get immunityBonus() {
        if (this.info._type !== "Boots") return undefined;

        return this.raw.immunityBonus;
    }

    set immunityBonus(immunityBonus) {
        if (this.immunityBonus === undefined)
            throw new Error("Item is not boots");

        if (immunityBonus === undefined || immunityBonus < 0)
            throw new Error("Immunity bonus must be at least 0");

        this.raw.immunityBonus = immunityBonus;
    }
}
