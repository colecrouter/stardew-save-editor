import jsondata from "$generated/iteminfo.json";
import {
    FurnitureType,
    type ItemInformation,
    ObjectCategory,
    type Shirt,
} from "$types/items";
import type { Item } from "$types/save";
export const HatWhichNumber = new Map([
    ["Cowboy Hat", 0],
    ["Bowler Hat", 1],
    ["Top Hat", 2],
    ["Straw Hat", 3],
    ["Trucker Hat", 4],
    ["Official Cap", 5],
    ["Blue Bonnet", 6],
    ["Plum Chapeau", 7],
    ["Skeleton Mask", 8],
    ["Goblin Mask", 9],
    ["Chicken Mask", 10],
    ["Earmuffs", 11],
    ["Delicate Bow", 12],
    ["Tropiclip", 13],
    ["Butterfly Bow", 14],
    ["Hunter's Cap", 15],
    ["Trucker Hat", 16],
    ["Sailor's Cap", 17],
    ["Good Ol' Cap", 18],
    ["Fedora", 19],
    ["Cool Cap", 20],
    ["Lucky Bow", 21],
    ["Polka Bow", 22],
    ["Gnome's Cap", 23],
    ["Eye Patch", 24],
    ["Santa Hat", 25],
    ["Tiara", 26],
    ["Hard Hat", 27],
    ["Sou'wester", 28],
    ["Daisy", 29],
    ["Watermelon Band", 30],
    ["Mouse Ears", 31],
    ["Cat Ears", 32],
    ["Cowgal Hat", 33],
    ["Cowpoke Hat", 34],
    ["Archer's Cap", 35],
    ["Panda Hat", 36],
    ["Blue Cowboy Hat", 37],
    ["Red Cowboy Hat", 38],
    ["Cone Hat", 39],
    ["Living Hat", 40],
    ["Emily's Magic Hat", 41],
    ["Mushroom Cap", 42],
    ["Dinosaur Hat", 43],
    ["Totem Mask", 44],
    ["Logo Cap", 45],
    ["Wearable Dwarf Helm", 46],
    ["Fashion Hat", 47],
    ["Pumpkin Mask", 48],
    ["Hair Bone", 49],
    ["Knight's Helmet", 50],
    ["Squire's Helmet", 51],
    ["Spotted Headscarf", 52],
    ["Beanie", 53],
    ["Floppy Beanie", 54],
    ["Fishing Hat", 55],
    ["Blobfish Mask", 56],
    ["Party Hat", 57],
    ["Arcane Hat", 60],
    ["Chef's Hat", 61],
    ["Pirate Hat", 62],
    ["Flat Topped Hat", 63],
    ["Elegant Turban", 64],
    ["White Turban", 65],
    ["Garbage Hat", 66],
    ["Golden Mask", 67],
    ["Propeller Hat", 68],
    ["Bridal Veil", 69],
    ["Witch Hat", 70],
    ["Copper Pan", 71],
    ["Green Turban", 72],
    ["Magic Cowbow Hat", 73],
    ["Magic Turban", 74],
    ["Golden Helmet", 75],
    ["Deluxe Pirate Hat", 76],
    ["Pink Bow", 77],
    ["Frog Hat", 78],
    ["Small Cap", 79],
    ["Bluebird Mask", 80],
    ["Deluxe Cowboy Hat", 81],
    ["Mr. Qi's Hat", 82],
    ["Dark Cowboy Hat", 83],
    ["Radioactive Goggles", 84],
    ["Swashbuckler Hat", 85],
    ["Qi Mask", 86],
    ["Star Helmet", 87],
    ["Sunglasses", 88],
    ["Goggles", 89],
    ["Forager's Hat", 90],
    ["Tiger Hat", 91],
    ["???", 92],
    ["Warrior Helmet", 93],
]);

export const FishingRodUpgradeNumber = new Map([
    ["Bamboo Pole", 0],
    ["Training Rod", 1],
    ["Fiberglass Rod", 2],
    ["Iridium Rod", 3],
]);

export const FishingRodSpriteIndex = new Map([
    ["Bamboo Pole", 8],
    ["Training Rod", 9],
    ["Fiberglass Rod", 10],
    ["Iridium Rod", 11],
]);

// TODO: I don't know what items are allowed to have quality, or if there's some sort of rule.
export const CategoriesWithQuality = new Set([
    ObjectCategory.Fish,
    ObjectCategory.Egg,
    ObjectCategory.Milk,
    ObjectCategory.Cooking,
    ObjectCategory.SellAtPierres,
    ObjectCategory.SellAtPierresAndMarnies,
    ObjectCategory.ArtisanGoods,
    ObjectCategory.Syrup,
    ObjectCategory.Vegetable,
    ObjectCategory.Fruit,
    ObjectCategory.Flower,
    ObjectCategory.Forage,
]);

export const FurnitureTypeToNumber = new Map<FurnitureType, number>([
    [FurnitureType.Chair, 0],
    [FurnitureType.Bench, 1],
    [FurnitureType.Couch, 2],
    [FurnitureType.Armchair, 3],
    [FurnitureType.Dresser, 4],
    [FurnitureType.LongTable, 5],
    [FurnitureType.Painting, 6],
    [FurnitureType.Lamp, 7],
    [FurnitureType.Decor, 8],
    [FurnitureType.Other, 9],
    [FurnitureType.Bookcase, 10],
    [FurnitureType.Table, 11],
    [FurnitureType.Rug, 12],
    [FurnitureType.Window, 13],
    [FurnitureType.Fireplace, 14],
    [FurnitureType.Bed, 15],
    [FurnitureType.Torch, 16],
    [FurnitureType.Sconce, 17],
]);

export const BootsColorSheetIndex = new Map<string, number>([
    ["Sneakers", 0],
    ["Rubber Boots", 1],
    ["Leather Boots", 2],
    ["Work Boots", 3],
    ["Combat Boots", 4],
    ["Tundra Boots", 5],
    ["Leprechaun Shoes", 14],
    ["Thermal Boots", 6],
    ["Cowboy Boots", 12], // 11?
    ["Dark Boots", 7],
    ["Firewalker Boots", 8],
    ["Genie Shoes", 9],
    ["Space Boots", 10],
    ["Emily's Magic Boots", 13],
    ["Cinderclown Shoes", 15],
    ["Merman's Boots", 16],
    ["Dragonscale Boots", 17],
    ["Crystal Shoes", 18],
]);

export const RingsUniqueID = new Map<string, number>([
    ["Small Glow Ring", 1267],
    ["Glow Ring", 1238],
    ["Small Magnet Ring", 1269],
    ["Magnet Ring", 1270],
    ["Slime Charmer Ring", 1271],
    ["Warrior Ring", 1272],
    ["Vampire Ring", 1273],
    ["Savage Ring", 1274],
    ["Ring of Yoba", 1275],
    ["Sturdy Ring", 1276],
    ["Burglar's Ring", 1247],
    ["Iridium Band", 1248],
    ["Jukebox Ring", 1249],
    ["Amethyst Ring", 1169],
    ["Topaz Ring", 1281],
    ["Aquamarine Ring", 1191],
    ["Jade Ring", 1253],
    ["Emerald Ring", 1254],
    ["Ruby Ring", 1285],
    ["Crabshell Ring", 1531],
    ["Napalm Ring", 1562],
    ["Thorns Ring", 1590],
    ["Lucky Ring", 1580],
    ["Hot Java Ring", 1581],
    ["Protection Ring", 1612],
    ["Soul Sapper Ring", 1613],
    ["Phoenix Ring", 1614],
    ["Combined Ring", 1601],
    ["Glowstone Ring", 1609],
]);

export const ItemData = new Map<string, ItemInformation>(jsondata);

export const KeyToName = (key: string, type: string) => {
    for (const [, item] of jsondata) {
        if (item._key === key && item._type === type) {
            return item.name;
        }
    }

    throw new Error(`Key ${key} not found for type ${type}`);
};

export const ItemNameHelper = (item: Item) => {
    if (item.name === "Fishing Rod") {
        switch (item.upgradeLevel) {
            case 0:
                return "Bamboo Pole";
            case 1:
                return "Training Rod";
            case 2:
                return "Fiberglass Rod";
            case 3:
                return "Iridium Rod";
        }
    }

    // No scythe, milking pail, or shears
    const tools = ["Pickaxe", "Axe", "Hoe", "Watering Can"];
    for (const tool of tools) {
        if (item.name.endsWith(tool)) {
            switch (item.upgradeLevel) {
                case 4:
                    return `Iridium ${tool}`;
                case 3:
                    return `Gold ${tool}`;
                case 2:
                    return `Steel ${tool}`;
                case 1:
                    return `Copper ${tool}`;
                default:
                    return tool;
            }
        }
    }

    return item.name;
};

export const Shirts = new Map<string, Shirt>(
    jsondata
        .filter(([, item]) => item._type === "Shirt")
        .map(([, item]) => [item._key, item]),
);
