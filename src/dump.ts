import { copyFile, readdir, readFile, writeFile } from 'fs/promises';
import type { BigCraftable, Boots, Clothing, ClothingType, MeleeWeapon, ObjectInformation, ObjectType, RangedWeapon, Weapon, MeleeWeaponType, Hat, Furniture, FurnitureType, Tool } from './types/dump';

const indexToSprite = (index: number, itemWidth: number, sheetWidth: number) => {
    const x = (index * itemWidth) % sheetWidth + itemWidth;
    const y = Math.floor((index * itemWidth) / sheetWidth) * itemWidth + itemWidth;
    return { x, y };
};

const indexToSpriteShirts = (index: number) => {
    const sheetW = 128;
    const itemW = 8;

    // We have to offset shirts by -1000 https://stardewvalleywiki.com/Modding:Items#Data_format_4
    index = index - 1000;

    const x = (index * itemW) % sheetW + itemW;
    const y = Math.floor((index * itemW) / sheetW) * (itemW * 4) + itemW;

    return { x, y };
};

const indexToSpritePants = (index: number) => {
    const sheetW = 192;
    const itemW = 8;

    const x = (index * itemW * 12) % sheetW + (itemW * 2);
    const y = Math.floor((index * itemW) / sheetW) * (688) + (itemW * 4);

    return { x, y };
};

const objects = JSON.parse(await readFile('./content/Data/ObjectInformation.json', 'utf-8')) as Record<string, string>;
const objectsArray = Object.entries(objects).map(([key, value]) => {
    const props = value.split('/');
    const [type, category] = props[3].split(' ');

    // There's a ton of "Stone" entries in objects, only use the one that has an id of 390
    if (props[0] === 'Stone' && Number(key) !== 390) return undefined;

    return {
        _type: 'ObjectInformation',
        name: props[0],
        price: Number(props[1]),
        edibility: Number(props[2]),
        type: type as ObjectType,
        category: Number(category),
        displayName: props[4],
        description: props[5],
        misc1: props[6] ? Number(props[7]) : undefined,
        misc2: props[7] ? Number(props[8]) : undefined,
        buffDuration: props[8] ? Number(props[9]) : undefined,
        sprite: indexToSprite(Number(key), 16, 384),
    } satisfies ObjectInformation;
}).filter((x) => x !== undefined) as ObjectInformation[];

const bigCraftables = JSON.parse(await readFile('./content/Data/BigCraftablesInformation.json', 'utf-8')) as Record<string, string>;
const bigCraftablesArray = Object.entries(bigCraftables).map(([key, value]) => {
    const props = value.split('/');
    return {
        _type: 'BigCraftable',
        name: props[0],
        price: Number(props[1]),
        edibility: Number(props[2]),
        type: props[3].split(' ')[0] as ObjectType,
        category: -9,
        description: props[4],
        outdoors: props[5] === 'true',
        indoors: props[6] === 'true',
        fragility: Number(props[7]),
        isLamp: props[8] === 'true',
        displayName: props[9],
        sprite: indexToSprite(Number(key), 16, 384),
    } satisfies BigCraftable;
});

const boots = JSON.parse(await readFile('./content/Data/Boots.json', 'utf-8')) as Record<string, string>;
const bootsArray = Object.entries(boots).map(([key, value]) => {
    const props = value.split('/');
    return {
        _type: 'Boots',
        name: props[0],
        description: props[1],
        price: Number(props[2]),
        addedDefense: Number(props[3]),
        addedImmunity: Number(props[4]),
        colorIndex: Number(props[5]),
        displayName: props[6],
        sprite: indexToSprite(Number(key), 16, 384),
    } satisfies Boots;
});

const clothing = JSON.parse(await readFile('./content/Data/ClothingInformation.json', 'utf-8')) as Record<string, string>;
const clothingArray = Object.entries(clothing).map(([key, value]) => {
    const props = value.split('/');
    const color = props[6].split(' ');

    let sprite;
    if ((props[8] as ClothingType) === 'Shirt') {
        sprite = indexToSpriteShirts(Number(key));
    } else {
        sprite = indexToSpritePants(Number(key));  // Pants
    }

    return {
        _type: 'Clothing',
        name: props[0],
        displayName: props[1],
        description: props[2],
        maleIndex: Number(props[3]),
        femaleIndex: Number(props[4]),
        price: Number(props[5]),
        defaultColor: {
            r: Number(color[0]),
            g: Number(color[1]),
            b: Number(color[2]),
        },
        dyeable: props[7] === 'true',
        type: props[8] as ClothingType,
        extraData: props[9],
        sprite: sprite,
    } satisfies Clothing;
});

const furniture = JSON.parse(await readFile('./content/Data/Furniture.json', 'utf-8')) as Record<string, string>;
const furnitureArray = Object.entries(furniture).map(([key, value]) => {
    const props = value.split('/');
    return {
        _type: 'Furniture',
        name: props[0],
        type: Number(props[1]) as FurnitureType,
        tilesheetSize: Number(props[2]),
        boundingBoxSize: Number(props[3]),
        rotations: Number(props[4]),
        price: Number(props[5]),
        displayName: props[6],
        placementRestriction: Number(props[7]),
        sprite: indexToSprite(Number(key), 16, 512),
    } satisfies Furniture;
});

const hats = JSON.parse(await readFile('./content/Data/Hats.json', 'utf-8')) as Record<string, string>;
const hatsArray = Object.entries(hats).map(([key, value]) => {
    const props = value.split('/');
    return {
        _type: 'Hat',
        name: props[0],
        description: props[1],
        showRealHair: props[2] === 'true',
        skipHairstyleOffset: props[3] === 'true',
        displayName: props[4],
        sprite: indexToSprite(Number(key), 16, 240),
    } satisfies Hat;
});

const weapons = JSON.parse(await readFile('./content/Data/Weapons.json', 'utf-8')) as Record<string, string>;
const weaponsArray = Object.entries(weapons).map(([key, value]) => {
    const props = value.split('/');
    return props[0].search('Slingshot') !== -1 ? {
        _type: 'RangedWeapon',
        name: props[0],
        description: props[1],
        minDamage: Number(props[2]),
        maxDamage: Number(props[3]),
        displayName: props[4],
        sprite: indexToSprite(Number(key), 16, 128),
    } satisfies RangedWeapon :
        {
            _type: 'MeleeWeapon',
            name: props[0],
            description: props[1],
            minDamage: Number(props[2]),
            maxDamage: Number(props[3]),
            knockback: Number(props[4]),
            speed: Number(props[5]),
            addedPrecision: Number(props[6]),
            addedDefense: Number(props[7]),
            type: Number(props[8]) as MeleeWeaponType,
            baseMineLevel: Number(props[9]),
            minMineLevel: Number(props[10]),
            addedAreaOfEffect: Number(props[11]),
            criticalChance: Number(props[12]),
            criticalDamage: Number(props[13]),
            displayName: props[14],
            sprite: indexToSprite(Number(key), 16, 128),
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
        name: value,
        sprite: indexToSprite(Number(key), 16, 336),
    } satisfies Tool;
});

const cookingRecipes = JSON.parse(await readFile('./content/Data/CookingRecipes.json', 'utf-8')) as Record<string, string>;
const cookingRecipesArray = Object.entries(cookingRecipes).map(([key]) => key);
await writeFile('./static/cookingrecipes.json', JSON.stringify(cookingRecipesArray));

const craftingRecipes = JSON.parse(await readFile('./content/Data/CraftingRecipes.json', 'utf-8')) as Record<string, string>;
const craftingRecipesArray = Object.entries(craftingRecipes).map(([key]) => key);
await writeFile('./static/craftingrecipes.json', JSON.stringify(craftingRecipesArray));

const writeToFile = JSON.stringify([...objectsArray, ...bigCraftablesArray, ...bootsArray, ...clothingArray, ...furnitureArray, ...hatsArray, ...weaponsArray, ...toolsArray].map(item => [item.name, item]));
await writeFile('./static/iteminfo.json', writeToFile);

// Copy all textures into assets folder
await copyFile(`./content/TileSheets/Craftables.png`, `./static/assets/Craftables.png`);
await copyFile(`./content/TileSheets/furniture.png`, `./static/assets/furniture.png`);
await copyFile(`./content/TileSheets/weapons.png`, `./static/assets/weapons.png`);
await copyFile(`./content/TileSheets/tools.png`, `./static/assets/tools.png`);
await copyFile(`./content/Characters/Farmer/pants.png`, `./static/assets/pants.png`);
await copyFile(`./content/Characters/Farmer/shirts.png`, `./static/assets/shirts.png`);
await copyFile(`./content/Characters/Farmer/shoeColors.png`, `./static/assets/shoeColors.png`);
await copyFile('./content/maps/springobjects.png', './static/assets/springobjects.png');
await copyFile('./content/Characters/Farmer/hats.png', './static/assets/hats.png');

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
    await copyFile(`./content/Portraits/${char}.png`, `./static/assets/portraits/${char}.png`);
};