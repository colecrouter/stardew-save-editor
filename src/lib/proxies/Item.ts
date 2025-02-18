import {
    CategoriesWithQuality,
    FishingRodSpriteIndex,
    FishingRodUpgradeNumber,
    FurnitureTypeToNumber,
    ItemData,
    ItemNameHelper,
    RingsUniqueID,
    Shirts,
} from "$lib/ItemData";
import { Sprite } from "$lib/Sprite";
import { Color } from "$lib/proxies/Color";
import {
    FurnitureType,
    type ItemInformation,
    ObjectCategory,
    type ToolClass,
} from "$types/items";
import { ClothesType, type Item as ItemModel, TypeEnum } from "$types/save";

const nil = { "@_xsi:nil": "true" };

// Mapping of data types to item types
const typeToItemTypeMap = new Map<ItemInformation["_type"], string>([
    ["Object", "Object"],
    ["BigCraftable", "Object"],
    ["Furniture", "Furniture"],
    ["Weapon", "MeleeWeapon"],
    ["Hat", "Hat"],
    ["Shirt", "Clothing"],
    ["Pants", "Clothing"],
    ["Boots", "Boots"],
]);

// Mapping of tool names to tool types
const toolTypeMap = new Map<string, ToolClass>([
    ["Pail", "MilkPail"],
    ["Pickaxe", "Pickaxe"],
    ["Axe", "Axe"],
    ["Hoe", "Hoe"],
    ["Can", "WateringCan"],
    ["Rod", "FishingRod"],
    ["Pan", "Pan"],
]);

const toolNameMap = new Map<string, string>([
    ["Can", "Watering Can"],
    ["Rod", "Fishing Rod"],
    ["Pan", "Copper Pan"],
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
    BigCraftable: ObjectCategory.BigCraftable,
    Boots: ObjectCategory.Boots,
    Pants: ObjectCategory.Clothing,
    Shirt: ObjectCategory.Clothing,
    Furniture: ObjectCategory.Furniture,
    Hat: ObjectCategory.Hat,
    Weapon: ObjectCategory.Weapon,
    Tool: ObjectCategory.Tool,
};

export class Item {
    readonly raw: ItemModel;
    readonly info?: ItemInformation;
    readonly sprite?: Sprite;

    constructor(raw: ItemModel) {
        this.raw = raw;
        // TODO shirt hack, need to fix
        const info =
            raw.name === "Shirt"
                ? Shirts.get(raw.itemId.toString())
                : ItemData.get(ItemNameHelper(raw));
        // if (!info) throw new Error(`Item "${raw.name}" not found in ItemData`);
        if (!info) {
            console.warn(`Item "${raw.name}" not found in ItemData`);
            return;
        }

        this.info = info;
        this.sprite = new Sprite(info);
    }

    static fromName(name: string) {
        let data = ItemData.get(name);
        if (!data) {
            data = Shirts.get(name);
        }

        if (!data) throw new Error(`Item "${name}" not found in ItemData`);

        // Determine the ObjectCategory
        // Lots of items are missing a ObjectCategory in the data, so we need to handle them separately
        const category =
            "category" in data ? data.category : typeToCategoryMap[data._type];

        // Initialize the item
        const item: ItemModel = {
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
                    ? data.type
                    : data._type === "BigCraftable"
                      ? "Crafting"
                      : undefined,
            bigCraftable: data._type === "BigCraftable" ? true : undefined,
        };

        // Set quality for items that can have quality
        if (category && CategoriesWithQuality.has(category)) {
            item.quality = 0;
        }

        // Determine the item type
        let itemType = typeToItemTypeMap.get(data._type);

        // Handle tools separately
        if (data._type === "Tool") {
            // Remove "Steel" from "Steel Watering Can" etc.
            const nameWithoutPrefix = name.split(" ").pop() ?? name;
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
                        item.name =
                            toolNameMap.get(nameWithoutPrefix) ??
                            nameWithoutPrefix;
                        break;
                    }
                }
                item.indexOfMenuItemView = data.menuSpriteIndex;
            } else if (itemType === "FishingRod") {
                item.upgradeLevel = FishingRodUpgradeNumber.get(data.name) ?? 0;
                item.parentSheetIndex = 685;
                item.initialParentTileIndex =
                    FishingRodSpriteIndex.get(data.name) ?? 0;
                item.indexOfMenuItemView = item.initialParentTileIndex;
            }

            if (itemType === "WateringCan") {
                item.IsBottomless = false;
                item.isBottomless = false;
            }
        }

        // Handle weapon properties
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

        // Set the xsi:type if itemType is determined
        if (itemType) {
            // This is required for the game to recognize the item as the correct type, but isn't part of the XML structures
            // @ts-expect-error
            item["@_xsi:type"] = itemType;
        }

        // Set ID for rings
        if (data._type === "Object" && data.type === TypeEnum.Ring) {
            item.uniqueID = RingsUniqueID.get(name);
            console.log(item.uniqueID);
            // @ts-expect-error
            item["@_xsi:type"] = "Ring";
        }

        // Handle hats
        if (data._type === "Hat") {
            // @ts-expect-error
            item.which = nil;
            item.skipHairDraw = data.showRealHair;
            item.ignoreHairstyleOffset = data.skipHairstyleOffset;
        }

        // Handle furniture
        if (data._type === "Furniture") {
            item.canBeGrabbed = true;
            item.type = FurnitureTypeToNumber.get(data.type as FurnitureType);

            // Set sourceRect if TilesheetSize is available
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

            // Set boundingBox if BoundingBoxSize is available
            if (
                "boundingBoxSize" in data &&
                data.boundingBoxSize !== undefined
            ) {
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

            // Enable lamp property for lamp-type furniture
            if (data.type === FurnitureType.Lamp) {
                item.isLamp = true;
            }
        }

        // Handle dyeable items
        if ("canBeDyed" in data && data.canBeDyed) {
            let defaultColor = new Color("#FFFFFF");
            // if (data.defaultColor) {
            //     console.log(data.defaultColor);
            //     const [R, G, B] = data.defaultColor.split(" ").map(Number);
            //     if (!R || !G || !B)
            //         throw new Error(`Invalid color for item "${name}"`);
            //     defaultColor = new Color({ R, G, B });
            // }
            // item.clothesColor = defaultColor;
            // Default color is actually just RED for some reason

            item.clothesColor = defaultColor;
        }

        // Set edibility and price if available
        if ("edibility" in data) {
            item.edibility = data.edibility;
        }
        item.price = data.price ?? 0;

        // Handle clothes types
        if (data._type in ClothesType) {
            item.clothesType =
                ClothesType[data._type as keyof typeof ClothesType];
        }
        if (data._type === "Boots") {
            item.indexInColorSheet = data.colorIndex;
        }

        // Handle preserved items
        if (
            "unpreservedItemId" in data &&
            data.unpreservedItemId &&
            data.preservedItemName
        ) {
            item.preservedParentSheetIndex = Number.parseInt(
                data.unpreservedItemId,
            );

            item.preserve = data.preservedItemName;
        }

        // Handle colored items (e.g. Wines, Juices)
        if (data.color) {
            item.color = new Color(data.color);

            if (data._type === "Object") {
                // @ts-expect-error
                item["@_xsi:type"] = "ColoredObject";
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
        return this.info?._type;
    }

    get amount() {
        if (!this.info) return undefined;
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
        return this.raw.stack ?? 1;
    }

    set amount(amount) {
        if (this.amount === undefined)
            throw new Error("Amount is not applicable to this item");
        if (amount === undefined) throw new Error("Amount must be a number");

        this.raw.stack = amount;
    }

    get quality() {
        if (!this.raw.category) return undefined;
        if (!CategoriesWithQuality.has(this.raw.category)) return undefined;

        return this.raw.quality;
    }

    set quality(quality) {
        if (this.quality === undefined) throw new Error("Item has no quality");
        if (quality === undefined) throw new Error("Quality must be a number");

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
            !this.info ||
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
            !this.info ||
            !("canBeDyed" in this.info) ||
            !this.info.canBeDyed ||
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
        if (this.info?._type !== "Weapon") return undefined;

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
        if (this.info?._type !== "Weapon") return undefined;

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
        if (this.info?._type !== "Weapon") return undefined;

        return this.raw.speed;
    }

    set speed(speed) {
        if (this.speed === undefined) throw new Error("Item is not a weapon");

        if (speed === undefined || speed < 0 || speed > 999)
            throw new Error("Speed must be between 0 and 999");

        this.raw.speed = speed;
    }

    get knockback() {
        if (this.info?._type !== "Weapon") return undefined;

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
        if (this.info?._type !== "Weapon") return undefined;

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
        if (this.info?._type !== "Weapon") return undefined;

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
        if (this.info?._type !== "Weapon") return undefined;

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
        if (this.info?._type !== "Weapon") return undefined;

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
        if (!this.info || !["Boots", "Weapon"].includes(this.info._type))
            return undefined;

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
        if (this.info?._type !== "Boots") return undefined;

        return this.raw.immunityBonus;
    }

    set immunityBonus(immunityBonus) {
        if (this.immunityBonus === undefined)
            throw new Error("Item is not boots");

        if (immunityBonus === undefined || immunityBonus < 0)
            throw new Error("Immunity bonus must be at least 0");

        this.raw.immunityBonus = immunityBonus;
    }

    get isBottomless() {
        if (this.raw.name !== "Watering Can") return undefined;

        return this.raw.isBottomless;
    }

    set isBottomless(isBottomless) {
        if (this.raw.name !== "Watering Can")
            throw new Error("Item is not a watering can");

        this.raw.isBottomless = isBottomless;
        this.raw.IsBottomless = isBottomless;
    }
}
