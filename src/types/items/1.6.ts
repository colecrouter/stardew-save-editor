import type { TypeEnum } from "$types/save/1.6";

interface Base {
    _type: string;
    _key: string;
    // Basic info
    name: string;
    displayName: string;
    description?: string;
    price?: number;
    // Appearance
    texture?: string;
    spriteIndex?: number;
}

export interface RegularObject extends Base {
    _type: "Object";
    // Basic info
    type: TypeEnum;
    category: ObjectCategory;
    // Edibility
    edibility?: number;
    isDrink?: boolean;
}

export interface BigCraftable extends Base {
    _type: "BigCraftable";
    _key: string;
    // Behavior
    fragility?: Fragility;
    canBePlacedIndoors?: boolean;
    canBePlacedOutdoors?: boolean;
    isLamp?: boolean;
}

export interface Boots extends Base {
    _type: "Boots";
    defense: number;
    immunity: number;
    colorIndex: number;
    displayName: string;
    colorTexture?: string;
}

export interface Pants extends Base {
    _type: "Pants";
    // Appearance
    defaultColor?: string;
    canBeDyed?: boolean;
    isPrismatic?: boolean;
}

export interface Shirt extends Base {
    _type: "Shirt";
    // Appearance
    defaultColor?: string;
    canBeDyed?: boolean;
    isPrismatic?: boolean;
    hasSleeves?: boolean;
}

export interface Furniture extends Base {
    _type: "Furniture";
    type: FurnitureType;
    tilesheetSize?: Size;
    boundingBoxSize?: Size;
    rotations: number;
    placementRestriction: PlacementRestriction;
    offLimitsForRandomSale?: boolean;
}

export interface Hat extends Base {
    _type: "Hat";
    showRealHair: boolean;
    skipHairstyleOffset: boolean;
}

export interface Tool extends Base {
    _type: "Tool";
    class: ToolClass;
    attachmentSlots?: number;
    salePrice?: number;
    // Appearance
    texture: string;
    spriteIndex: number;
    menuSpriteIndex?: number;
    upgradeLevel?: number;
}

export interface Weapon extends Base {
    _type: "Weapon";
    // Basic info
    type: MeleeWeaponType;
    // Appearance
    texture: string;
    spriteIndex: number;
    // Stats
    minDamage: number;
    maxDamage: number;
    knockback: number;
    speed: number;
    precision: number;
    defense: number;
    areaOfEffect: number;
    critChance: number;
    critMultiplier: number;
    // Game logic
    canBeLostOnDeath: boolean;
    mineBaseLevel: number;
    mineMinLevel: number;
}

export type ItemInformation =
    | RegularObject
    | BigCraftable
    | Boots
    | Pants
    | Shirt
    | Furniture
    | Hat
    | Tool
    | Weapon;

export enum Fragility {
    PickUpWithAnyTool = 0,
    DestroyedIfHitWithAxeHoeOrPickaxe = 1,
    Indestructible = 2,
}

export enum FurnitureType {
    Chair = "chair",
    Bench = "bench",
    Couch = "couch",
    Armchair = "armchair",
    Dresser = "dresser",
    LongTable = "long table",
    Painting = "painting",
    Lamp = "lamp",
    Decor = "decor",
    Other = "other",
    Bookcase = "bookcase",
    Table = "table",
    Rug = "rug",
    Window = "window",
    Fireplace = "fireplace",
    Bed = "bed",
    Torch = "torch",
    Sconce = "sconce",
}

export enum PlacementRestriction {
    Default = -1,
    IndoorsOnly = 0,
    OutdoorsOnly = 1,
    Both = 2,
}

export enum ObjectCategory {
    Gem = -2,
    Fish = -4,
    Egg = -5,
    Milk = -6,
    Cooking = -7,
    Crafting = -8,
    BigCraftable = -9,
    Mineral = -12,
    Meat = -14,
    MetalResources = -15,
    BuildingResources = -16,
    SellAtPierres = -17,
    SellAtPierresAndMarnies = -18,
    Fertilizer = -19,
    Junk = -20,
    Bait = -21,
    Tackle = -22,
    SellAtFishShop = -23,
    Furniture = -24,
    Ingredients = -25,
    ArtisanGoods = -26,
    Syrup = -27,
    MonsterLoot = -28,
    Equipment = -29,
    Seeds = -74,
    Vegetable = -75,
    Fruit = -79,
    Flower = -80,
    Forage = -81,
    Hat = -95,
    Ring = -96,
    Boots = -97,
    Weapon = -98,
    Tool = -99,
    Clothing = -100,
}

export enum MeleeWeaponType {
    StabbingSword = 0,
    Dagger = 1,
    ClubOrHammer = 2,
    SlashingSword = 3,
}

export type Size = { width: number; height: number };

export type Coordinates = { x: number; y: number };

export type ToolClass =
    | "Axe"
    | "FishingRod"
    | "Hoe"
    | "Lantern"
    | "MilkPail"
    | "Pan"
    | "Pickaxe"
    | "Wand"
    | "Shears"
    | "WateringCan"
    | "GenericTool";
