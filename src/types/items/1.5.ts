export interface HasSprite {
    Sprite: {
        x: number;
        y: number;
    };
    FemaleSprite?: {
        x: number;
        y: number;
    };
    ParentSheetIndex: number;
}

export interface ObjectInformation extends HasSprite {
    _type: 'ObjectInformation';
    Name: string;
    Price: number;
    Edibility: number;
    Type: import('../save/1.5').TypeEnum;
    Category?: number;
    DisplayName?: string;
    Description: string;
    Misc1?: number;
    Misc2?: number;
    BuffDuration?: number;
}

export enum Fragility {
    PickUpWithAnyTool = 0,
    DestroyedIfHitWithAxeHoeOrPickaxe = 1,
    Indestructible = 2,
}

export interface BigCraftable extends HasSprite {
    _type: 'BigCraftable';
    Name: string;
    Price: number;
    Edibility: number;
    Type: import('../save/1.5').TypeEnum;
    Category: -9;
    Description: string;
    CanBePlacedOutdoors: boolean;
    CanBePlacedIndoors: boolean;
    Fragility: Fragility;
    IsLamp: boolean;
    DisplayName?: string;
    ParentSheetIndex: number;
}

export interface Boots extends HasSprite {
    _type: 'Boots';
    Name: string;
    Description: string;
    Price: number;
    Defense: number;
    Immunity: number;
    ColorIndex: number;
    DisplayName?: string;
}

export type ClothingType = 'Pants' | 'Shirt' | 'Accessory';

interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface Clothing extends HasSprite {
    _type: 'Clothing';
    Name: string;
    DisplayName?: string;
    Description: string;
    MaleIndex: number;
    FemaleIndex: number;
    Price: number;
    DefaultColor: RGB;
    Dyeable: boolean;
    Type: ClothingType;
    ExtraData: string;
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
    Name: string;
    Type: FurnitureType;
    TilesheetSize: Size | -1;
    BoundingBoxSize: Size | -1;
    Rotations: number;
    Price: number;
    DisplayName?: string;
    PlacementRestriction: FurniturePlacement;
}

export interface Hat extends HasSprite {
    _type: 'Hat';
    Name: string;
    Description: string;
    ShowRealHair: boolean;
    SkipHairstyleOffset: boolean;
    DisplayName?: string;
}

// Tools are hardcoded
export interface Tool extends HasSprite {
    _type: 'Tool';
    Name: string;
}

export enum MeleeWeaponType {
    StabbingSword = 0,
    Dagger = 1,
    ClubOrHammer = 2,
    SlashingSword = 3,
}

export interface MeleeWeapon extends HasSprite {
    _type: 'MeleeWeapon';
    Name: string;
    Description: string;
    MinDamage: number;
    MaxDamage: number;
    Knockback: number;
    Speed: number;
    Precision: number;
    Defense: number;
    Type: MeleeWeaponType;
    MineBaseLevel: number;
    MineMinLevel: number;
    AreaOfEffect: number;
    CritChance: number;
    CritMultiplier: number;
    DisplayName?: string;
}

export interface RangedWeapon extends HasSprite {
    _type: 'RangedWeapon';
    Name: string;
    Description: string;
    MinDamage: number;
    MaxDamage: number;
    DisplayName?: string;
}

export type Weapon = MeleeWeapon | RangedWeapon;

export type ItemInformation = ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Tool | Weapon;