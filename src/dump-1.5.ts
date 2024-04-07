import { copyFile, readFile, writeFile } from 'fs/promises';
import type { BigCraftable, Boots, Clothing, ClothingType, Furniture, FurnitureType, Hat, MeleeWeapon, MeleeWeaponType, ObjectInformation, RangedWeapon, Tool } from './types/items/1.5';
import { GetSprite } from './lib/Spritesheet';
import type { TypeEnum } from './types/save/1.5';

const objects = JSON.parse(await readFile('./content/Data/ObjectInformation.json', 'utf-8')) as Record<string, string>;
const objectsArray = Object.entries(objects).map(([key, value]) => {
    const props = value.split('/');
    const [type, category] = props[3].split(' ');

    // There's a ton of "Stone" entries in objects, only use the one that has an id of 390
    if (props[0] === 'Stone' && Number(key) !== 390) return undefined;

    return {
        _type: 'ObjectInformation',
        Name: props[0],
        Price: Number(props[1]),
        Edibility: Number(props[2]),
        Type: type as TypeEnum,
        Category: Number(category),
        DisplayName: props[4],
        Description: props[5],
        Misc1: props[6] ? Number(props[7]) : undefined,
        Misc2: props[7] ? Number(props[8]) : undefined,
        BuffDuration: props[8] ? Number(props[9]) : undefined,
        Sprite: GetSprite('ObjectInformation', Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies ObjectInformation;
}).filter((x) => x !== undefined) as ObjectInformation[];

const bigCraftables = JSON.parse(await readFile('./content/Data/BigCraftablesInformation.json', 'utf-8')) as Record<string, string>;
const bigCraftablesArray = Object.entries(bigCraftables).map(([key, value]) => {
    // Skip 22 and 23, weird table business
    if (Number(key) === 22 || Number(key) === 23) return undefined;

    // Unobtainable items
    if ([26, 27, 64].includes(Number(key))) return undefined;

    const props = value.split('/');
    return {
        _type: 'BigCraftable',
        Name: props[0],
        Price: Number(props[1]),
        Edibility: Number(props[2]),
        Type: props[3].split(' ')[0] as TypeEnum,
        Category: -9,
        Description: props[4],
        CanBePlacedOutdoors: props[5] === 'true',
        CanBePlacedIutdoors: props[6] === 'true',
        Fragility: Number(props[7]),
        IsLamp: props[8] === 'true',
        DisplayName: props[9],
        Sprite: GetSprite('BigCraftable', Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies BigCraftable;
}).filter((x) => x !== undefined) as BigCraftable[];

const boots = JSON.parse(await readFile('./content/Data/Boots.json', 'utf-8')) as Record<string, string>;
const bootsArray = Object.entries(boots).map(([key, value]) => {
    const props = value.split('/');
    return {
        _type: 'Boots',
        Name: props[0],
        Description: props[1],
        Price: Number(props[2]),
        Defense: Number(props[3]),
        Immunity: Number(props[4]),
        ColorIndex: Number(props[5]),
        DisplayName: props[6],
        Sprite: GetSprite('Boots', Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies Boots;
});

const clothing = JSON.parse(await readFile('./content/Data/ClothingInformation.json', 'utf-8')) as Record<string, string>;
const clothingArray = Object.entries(clothing).map(([key, value]) => {
    const props = value.split('/');
    const color = props[6].split(' ');
    const type = props[8] as ClothingType;
    const dyeable = props[7] === 'true';

    let sprite;
    let femaleSprite;
    if (type === 'Shirt') {
        sprite = GetSprite('Clothing', Number(props[3]), type, dyeable);

        if (props[4] !== '-1') {
            femaleSprite = GetSprite('Clothing', Number(props[4]), type, dyeable);
        }
    } else {
        sprite = GetSprite('Clothing', Number(key), type);
    }

    return {
        _type: 'Clothing',
        Name: props[0],
        DisplayName: props[1],
        Description: props[2],
        MaleIndex: Number(props[3]),
        FemaleIndex: Number(props[4]),
        Price: Number(props[5]),
        DefaultColor: {
            r: Number(color[0]),
            g: Number(color[1]),
            b: Number(color[2]),
        },
        Dyeable: dyeable,
        Type: type,
        ExtraData: props[9],
        Sprite: sprite,
        FemaleSprite: femaleSprite,
        ParentSheetIndex: Number(key),
    } satisfies Clothing;
});

const furniture = JSON.parse(await readFile('./content/Data/Furniture.json', 'utf-8')) as Record<string, string>;
const furnitureArray = Object.entries(furniture).map(([key, value]) => {
    const props = value.split('/');
    const split2 = props[2].split(' ');
    const split3 = props[3].split(' ');

    return {
        _type: 'Furniture',
        Name: props[0],
        Type: props[1] as FurnitureType,
        TilesheetSize: split2[0] === '-1' ? -1 : { width: Number(split2[0]), height: Number(split2[1]) },
        BoundingBoxSize: split3[0] === '-1' ? -1 : { width: Number(split3[0]), height: Number(split3[1]) },
        Rotations: Number(props[4]),
        Price: Number(props[5]),
        DisplayName: props[6],
        PlacementRestriction: Number(props[7]),
        Sprite: GetSprite('Furniture', Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies Furniture;
});

const hats = JSON.parse(await readFile('./content/Data/Hats.json', 'utf-8')) as Record<string, string>;
const hatsArray = Object.entries(hats).map(([key, value]) => {
    const props = value.split('/');
    return {
        _type: 'Hat',
        Name: props[0],
        Description: props[1],
        ShowRealHair: props[2] === 'true',
        SkipHairstyleOffset: props[3] === 'true',
        DisplayName: props[4],
        Sprite: GetSprite('Hat', Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies Hat;
});

const weapons = JSON.parse(await readFile('./content/Data/Weapons.json', 'utf-8')) as Record<string, string>;
const weaponsArray = Object.entries(weapons).map(([key, value]) => {
    const props = value.split('/');
    return props[0].search('Slingshot') !== -1 ? {
        _type: 'RangedWeapon',
        Name: props[0],
        Description: props[1],
        MinDamage: Number(props[2]),
        MaxDamage: Number(props[3]),
        DisplayName: props[4],
        Sprite: GetSprite('RangedWeapon', Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies RangedWeapon :
        {
            _type: 'MeleeWeapon',
            Name: props[0],
            Description: props[1],
            MinDamage: Number(props[2]),
            MaxDamage: Number(props[3]),
            Knockback: Number(props[4]),
            Speed: Number(props[5]),
            Precision: Number(props[6]),
            Defense: Number(props[7]),
            Type: Number(props[8]) as MeleeWeaponType,
            MineBaseLevel: Number(props[9]),
            MineMinLevel: Number(props[10]),
            AreaOfEffect: Number(props[11]),
            CritChance: Number(props[12]),
            CritMultiplier: Number(props[13]),
            DisplayName: props[14],
            Sprite: GetSprite('MeleeWeapon', Number(key)),
            ParentSheetIndex: Number(key),
        } satisfies MeleeWeapon;
});

const tools = {
    "6": "Milk Pail",
    "7": "Shears",
    "8": "Bamboo Pole",
    "9": "Training Rod",
    "10": "Fiberglass Rod",
    "11": "Iridium Rod",
    "12": "Copper Pan",
    "47": "Hoe",
    "54": "Copper Hoe",
    "61": "Steel Hoe",
    "89": "Gold Hoe",
    "96": "Iridium Hoe",
    "131": "Pickaxe",
    "138": "Copper Pickaxe",
    "145": "Steel Pickaxe",
    "173": "Gold Pickaxe",
    "180": "Iridium Pickaxe",
    "215": "Axe",
    "222": "Copper Axe",
    "229": "Steel Axe",
    "257": "Gold Axe",
    "264": "Iridium Axe",
    "296": "Watering Can",
    "303": "Copper Watering Can",
    "310": "Steel Watering Can",
    "338": "Gold Watering Can",
    "345": "Iridium Watering Can",
};
const toolsArray = Object.entries(tools).map(([key, value]) => {
    return {
        _type: 'Tool',
        Name: value,
        Sprite: GetSprite('Tool', Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies Tool;
});

const cookingRecipes = JSON.parse(await readFile('./content/Data/CookingRecipes.json', 'utf-8')) as Record<string, string>;
const cookingRecipesArray = Object.entries(cookingRecipes).map(([key]) => key);
await writeFile('./static/1.5/cookingrecipes.json', JSON.stringify(cookingRecipesArray));

const craftingRecipes = JSON.parse(await readFile('./content/Data/CraftingRecipes.json', 'utf-8')) as Record<string, string>;
const craftingRecipesArray = Object.entries(craftingRecipes).map(([key]) => key);
await writeFile('./static/1.5/craftingrecipes.json', JSON.stringify(craftingRecipesArray));

const writeToFile = JSON.stringify([...objectsArray, ...bigCraftablesArray, ...bootsArray, ...clothingArray, ...furnitureArray, ...hatsArray, ...weaponsArray, ...toolsArray].map(item => [item.Name, item]));
await writeFile('./static/1.5/iteminfo.json', writeToFile);

// Copy all textures into assets folder
await copyFile(`./content/TileSheets/Craftables.png`, `./static/1.5/assets/Craftables.png`);
await copyFile(`./content/TileSheets/furniture.png`, `./static/1.5/assets/furniture.png`);
await copyFile(`./content/TileSheets/weapons.png`, `./static/1.5/assets/weapons.png`);
await copyFile(`./content/TileSheets/tools.png`, `./static/1.5/assets/tools.png`);
await copyFile(`./content/Characters/Farmer/pants.png`, `./static/1.5/assets/pants.png`);
await copyFile(`./content/Characters/Farmer/shirts.png`, `./static/1.5/assets/shirts.png`);
await copyFile(`./content/Characters/Farmer/accessories.png`, `./static/1.5/assets/accessories.png`);
// await copyFile(`./content/Characters/Farmer/farmer_base.png`, `./static/1.5/assets/farmer_base.png`);
// await copyFile(`./content/Characters/Farmer/farmer_base_bald.png`, `./static/1.5/assets/farmer_base_bald.png`);
// await copyFile(`./content/Characters/Farmer/farmer_girl_base.png`, `./static/1.5/assets/farmer_girl_base.png`);
// await copyFile(`./content/Characters/Farmer/farmer_girl_base_bald.png`, `./static/1.5/assets/farmer_girl_base_bald.png`);
await copyFile(`./content/Characters/Farmer/hairstyles.png`, `./static/1.5/assets/hairstyles.png`);
await copyFile(`./content/Characters/Farmer/hairstyles2.png`, `./static/1.5/assets/hairstyles2.png`);
await copyFile('./content/maps/springobjects.png', './static/1.5/assets/springobjects.png');
await copyFile('./content/Characters/Farmer/hats.png', './static/1.5/assets/hats.png');
await copyFile('./content/LooseSprites/daybg.png', './static/1.5/assets/daybg.png');

// Copy all portraits into assets folder
const chars = [
    'Abigail',
    'Alex',
    'Caroline',
    'Clint',
    'Demetrius',
    'Dwarf',
    'Elliott',
    'Emily',
    'Evelyn',
    'George',
    'Gus',
    'Haley',
    'Harvey',
    'Jas',
    'Jodi',
    'Kent',
    'Krobus',
    'Leah',
    'Lewis',
    'Linus',
    'Marnie',
    'Maru',
    'Pam',
    'Penny',
    'Pierre',
    'Robin',
    'Sam',
    'Sandy',
    'Sebastian',
    'Shane',
    'Vincent',
    'Willy',
    'Wizard',
];
for (const char of chars) {
    await copyFile(`./content/Portraits/${char}.png`, `./static/1.5/assets/portraits/${char}.png`);
};