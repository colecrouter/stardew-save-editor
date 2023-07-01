export interface HasSprite {
    sprite: {
        x: number;
        y: number;
    };
    femaleSprite?: {
        x: number;
        y: number;
    };
    parentSheetIndex: number;
}

export interface ObjectInformation extends HasSprite {
    _type: 'ObjectInformation';
    name: string;
    price: number;
    edibility: number;
    type: ObjectType;
    category?: number;
    displayName?: string;
    description: string;
    misc1?: number;
    misc2?: number;
    buffDuration?: number;
}

export type ObjectType = 'Ring' | 'Fish' | 'Arch' | 'asdf' | 'Seeds' | 'Crafting' | 'Quest' | 'Basic' | 'Cooking' | 'Minerals';

export enum Fragility {
    PickUpWithAnyTool = 0,
    DestroyedIfHitWithAxeHoeOrPickaxe = 1,
    Indestructible = 2,
}

export interface BigCraftable extends HasSprite {
    _type: 'BigCraftable';
    name: string;
    price: number;
    edibility: number;
    type: ObjectType;
    category: -9;
    description: string;
    outdoors: boolean;
    indoors: boolean;
    fragility: Fragility;
    isLamp: boolean;
    displayName?: string;
    parentSheetIndex: number;
}

export interface Boots extends HasSprite {
    _type: 'Boots';
    name: string;
    description: string;
    price: number;
    addedDefense: number;
    addedImmunity: number;
    colorIndex: number;
    displayName?: string;
}

export type ClothingType = 'Pants' | 'Shirt' | 'Accessory';

interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface Clothing extends HasSprite {
    _type: 'Clothing';
    name: string;
    displayName?: string;
    description: string;
    maleIndex: number;
    femaleIndex: number;
    price: number;
    defaultColor: RGB;
    dyeable: boolean;
    type: ClothingType;
    extraData: string;
}

export type Size = { width: number; height: number; };

export enum FurnitureType {
    Chair = 'chair',
    Bench = 'bench',
    Couch = 'couch',
    Armchair = 'armchair',
    Dresser = 'dresser',
    LongTable = 'long table',
    Painting = 'painting',
    Lamp = 'lamp',
    Decor = 'decor',
    Other = 'other',
    Bookcase = 'bookcase',
    Table = 'table',
    Rug = 'rug',
    Window = 'window',
    Fireplace = 'fireplace',
    Bed = 'bed',
    Torch = 'torch',
    Sconce = 'sconce',
}

export enum FurniturePlacement {
    Default = -1,
    IndoorsOnly = 0,
    OutdoorsOnly = 1,
    IndoorsOrOutdoors = 2,
}

export interface Furniture extends HasSprite {
    _type: 'Furniture';
    name: string;
    type: FurnitureType;
    tilesheetSize: Size | -1;
    boundingBoxSize: Size | -1;
    rotations: number;
    price: number;
    displayName?: string;
    placementRestriction: FurniturePlacement;
}

export interface Hat extends HasSprite {
    _type: 'Hat';
    name: string;
    description: string;
    showRealHair: boolean;
    skipHairstyleOffset: boolean;
    displayName?: string;
}

// Tools are hardcoded
export interface Tool extends HasSprite {
    _type: 'Tool';
    name: string;
}

export enum MeleeWeaponType {
    StabbingSword = 0,
    Dagger = 1,
    ClubOrHammer = 2,
    SlashingSword = 3,
}

export interface MeleeWeapon extends HasSprite {
    _type: 'MeleeWeapon';
    name: string;
    description: string;
    minDamage: number;
    maxDamage: number;
    knockback: number;
    speed: number;
    addedPrecision: number;
    addedDefense: number;
    type: MeleeWeaponType;
    baseMineLevel: number;
    minMineLevel: number;
    addedAreaOfEffect: number;
    criticalChance: number;
    criticalDamage: number;
    displayName?: string;
}

export interface RangedWeapon extends HasSprite {
    _type: 'RangedWeapon';
    name: string;
    description: string;
    minDamage: number;
    maxDamage: number;
    displayName?: string;
}

export type Weapon = MeleeWeapon | RangedWeapon;

export type ItemInformation = ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Tool | Weapon;