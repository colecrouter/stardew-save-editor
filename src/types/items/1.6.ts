import type { HasSprite, Size } from "$types/items/1.5";
import type { TypeEnum } from "$types/save/1.6";

interface Base {
    _type: string;
    Name: string;
    ItemId: string;
    DisplayName: string;
    Description: string;
    Price?: number;
    Texture?: string | null;
    SpriteIndex?: number;
    CustomFields?: never[] | null;
}

export interface Object extends Base {
    _type: "Object";
    Type: TypeEnum;
    Category: number;
    Price: number;
    Texture: null;
    SpriteIndex: number;
    Edibility: number;
    IsDrink: boolean;
    Buffs: null;
    GeodeDropsDefaultItems: boolean;
    GeodeDrops: null;
    ArtifactSpotChances: null;
    ExcludeFromFishingCollection: false;
    ExcludeFromShippingCollection: false;
    ExcludeFromRandomSale: false;
    ContextTags: ContextTag[] | null;
    CustomFields: never[] | null;
}

export interface GeodeDrop {
    Chance: number;
    SetFlagOnPickup: "goldenCoconutHat" | null;
    Precedence: number;
    Condition: null | string;
    Id: string;
    ItemId: `(O)${number}` | null;
    RandomItemId: `(O)${number}`[] | null;
    MaxItems: null;
    MinStack: -1;
    MaxStack: -1;
    Quality: -1;
    ObjectInternalName: null;
    ObjectDisplayName: null;
    ToolUpgradeLevel: -1;
    IsRecipe: false;
    StackModifiers: StackModifier[] | null;
    StackModifierMode: "Stack";
    QualityModifiers: never[] | null;
    QualityModifierMode: "Stack";
    ModData: null;
    PerItemCondition: null;
}

export interface StackModifier {
    Id: string;
    Condition: string;
    Modification: "Set";
    Amount: number;
    RandomAmount: number | null;
}

export enum Fragility {
    PickUpWithAnyTool = 0,
    DestroyedIfHitWithAxeHoeOrPickaxe = 1,
    Indestructible = 2,
}

export interface BigCraftable extends Base {
    _type: "BigCraftable";
    Price: number;
    Fragility: number;
    CanBePlacedOutdoors: boolean;
    CanBePlacedIndoors: boolean;
    IsLamp: boolean;
    Texture: null;
    SpriteIndex: number;
    ContextTags: ContextTag[] | null;
    CustomFields: never[] | null;
}

export interface Boots extends Base, HasSprite {
    _type: "Boots";
    Category: -97;
    Defense: number;
    Immunity: number;
    ColorIndex: number;
}

export interface Clothing extends Base {
    _type: "Pants" | "Shirt";
    Category: -100;
    Price: number;
    Texture: null;
    SpriteIndex: number;
    DefaultColor: string | null;
    CanBeDyed: boolean;
    IsPrismatic: boolean;
    CustomFields: null;
    HasSleeves?: boolean;
    CanChooseDuringCharacterCustomization?: boolean;
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

export interface Furniture extends Base, HasSprite {
    _type: "Furniture";
    Type: FurnitureType;
    TilesheetSize: Size | -1;
    BoundingBoxSize: Size | -1;
    Rotations: number;
}

export interface Hat extends Base, HasSprite {
    _type: "Hat";
    ShowRealHair: boolean;
    SkipHairstyleOffset: boolean;
}

export interface Weapon extends Base {
    _type: "Weapon";
    MinDamage: number;
    MaxDamage: number;
    Knockback: number;
    Speed: number;
    Precision: number;
    Defense: number;
    Type: WeaponType;
    MineBaseLevel: number;
    MineMinLevel: number;
    AreaOfEffect: number;
    CritChance: number;
    CritMultiplier: number;
    CanBeLostOnDeath: boolean;
    Texture: string | null;
    SpriteIndex: number;
    Projectiles: null;
    CustomFields: never[] | null;
}
export enum WeaponType {
    Saber = 0,
    Knife = 1,
    Club = 2,
    Sword = 3,
    Slingshot = 4,
}

export interface Tool extends Base {
    _type: "Tool";
    ClassName: ToolClassName;
    AttachMentSlots: number;
    SalePrice: number;
    Texture: string | null;
    currentParentTileIndex: number;
    MenuSpriteIndex: number;
    UpgradeLevel: number;
    ApplyUpgradeToDisplayName: boolean;
    ConventionalUpgradeFrom: string | null;
    UpgradeFrom: UpgradeFrom[] | null;
    CanBeLostOnDeath: boolean;
    SetProperties: null;
    ModData: null;
    CustomFields: never[] | null;
}

export interface UpgradeFrom {
    Condition: string;
    Price: number;
    RequireToolId: string | null;
    TradeItemId: string | null;
    TradeItemAmount: number;
}

export type ToolClassName =
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

export type ItemInformation =
    | Object
    | BigCraftable
    | Boots
    | Clothing
    | Furniture
    | Hat
    | Tool
    | Weapon;

export type ContextTag =
    | "color_brown"
    | "forage_item"
    | "season_spring"
    | "color_yellow"
    | "color_white"
    | "dye_medium"
    | "wood_item"
    | "color_green"
    | "color_aquamarine"
    | "color_red"
    | "color_purple"
    | "color_gold"
    | "color_jade"
    | "color_prismatic"
    | "crystalarium_banned"
    | "forage_item_mines"
    | "season_all"
    | "color_cyan"
    | "color_copper"
    | "color_dark_brown"
    | "forage_item_desert"
    | "fruit_item"
    | "fruit_tree_item"
    | "light_source"
    | "torch_item"
    | "color_light_cyan"
    | "dye_strong"
    | "scroll_item"
    | "color_blue"
    | "ancient_item"
    | "ceramic_item"
    | "color_gray"
    | "hunting_item"
    | "book_item"
    | "toy_item"
    | "elvish_item"
    | "noble_item"
    | "dinosaur_item"
    | "egg_item"
    | "color_dark_gray"
    | "cooking_item"
    | "cowboy_item"
    | "machine_item"
    | "chicken_item"
    | "color_sand"
    | "statue_item"
    | "prehistoric_item"
    | "marine_item"
    | "bone_item"
    | "instrument_item"
    | "dwarvish_item"
    | "golden_relic_item"
    | "doll_item"
    | "strange_doll_1"
    | "strange_doll_2"
    | "fish_ocean"
    | "fish_upright"
    | "season_summer"
    | "fish_talk_demanding"
    | "season_fall"
    | "season_winter"
    | "fish_river"
    | "fish_lake"
    | "fish_pond"
    | "color_orange"
    | "color_salmon"
    | "fish_secret_pond"
    | "fish_sewers"
    | "fish_swamp"
    | "fish_carnivorous"
    | "fish_talk_rude"
    | "fish_nonfish"
    | "algae_item"
    | "color_dark_green"
    | "use_reverse_name_for_sorting"
    | "fish_mines"
    | "fish_semi_rare"
    | "fish_legendary"
    | "fish_pond_ignore"
    | "fish_desert"
    | "drink_item"
    | "color_black"
    | "trash_item"
    | "large_egg_item"
    | "cow_milk_item"
    | "milk_item"
    | "large_milk_item"
    | "food_breakfast"
    | "food_salad"
    | "color_pink"
    | "food_party"
    | "food_seafood"
    | "food_spicy"
    | "food_bakery"
    | "food_soup"
    | "food_cake"
    | "food_sweet"
    | "food_pasta"
    | "food_sushi"
    | "food_sauce"
    | "crop_year_2"
    | "coffee_item"
    | "edible_mushroom"
    | "forage_item_cave"
    | "forage_item_secret"
    | "not_placeable"
    | "totem_item"
    | "color_iridium"
    | "geode_crusher_ignored"
    | "color_dark_purple"
    | "bomb_item"
    | "tree_seed_item"
    | "color_pale_violet_red"
    | "alcohol_item"
    | "mayo_item"
    | "furnace_item"
    | "color_iron"
    | "honey_item"
    | "pickle_item"
    | "color_dark_red"
    | "jelly_item"
    | "medicine_item"
    | "juice_item"
    | "color_dark_yellow"
    | "fertilizer_item"
    | "quality_fertilizer_item"
    | "beach_item"
    | "fish_crab_pot"
    | "forage_item_beach"
    | "flower_item"
    | "ore_item"
    | "color_dark_blue"
    | "slime_egg_item"
    | "slime_item"
    | "seedmaker_banned"
    | "goat_milk_item"
    | "ring_item"
    | "color_lime"
    | "fossil_item"
    | "color_dark_pink"
    | "color_poppyseed"
    | "fish_freshwater"
    | "syrup_item"
    | "color_yellow_green"
    | "potion_item"
    | "fish_talk_stiff"
    | "fish_bug_lair"
    | "fish_night_market"
    | "not_giftable"
    | "propose_roommate_krobus"
    | "ginger_item"
    | "preserves_pickle"
    | "fish_legendary_family"
    | "geode"
    | "color_dark_cyan"
    | "book_xp_foraging"
    | "book_xp_fishing"
    | "book_xp_mining"
    | "book_xp_combat"
    | "counts_as_fish_catch"
    | "sign_item"
    | "tapper_item"
    | "swappable_chest"
    | "light_source"
    | "torch_item"
    | "campfire_item"
    | "tapper_multiplier_2";
