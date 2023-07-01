import { copyFile, readFile, writeFile } from 'fs/promises';
import type { BigCraftable, Boots, Clothing, ClothingType, Furniture, FurnitureType, Hat, MeleeWeapon, MeleeWeaponType, ObjectInformation, ObjectType, RangedWeapon, Tool } from './types/items';
// @ts-expect-error
import { GetSprite } from './lib/Spritesheet.ts';

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
        sprite: GetSprite('ObjectInformation', Number(key)),
        parentSheetIndex: Number(key),
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
        sprite: GetSprite('BigCraftable', Number(key)),
        parentSheetIndex: Number(key),
    } satisfies BigCraftable;
}).filter((x) => x !== undefined) as BigCraftable[];

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
        sprite: GetSprite('Boots', Number(key)),
        parentSheetIndex: Number(key),
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
        dyeable: dyeable,
        type: type,
        extraData: props[9],
        sprite: sprite,
        femaleSprite: femaleSprite,
        parentSheetIndex: Number(key),
    } satisfies Clothing;
});

const furniture = JSON.parse(await readFile('./content/Data/Furniture.json', 'utf-8')) as Record<string, string>;
const furnitureArray = Object.entries(furniture).map(([key, value]) => {
    const props = value.split('/');
    const split2 = props[2].split(' ');
    const split3 = props[3].split(' ');

    return {
        _type: 'Furniture',
        name: props[0],
        type: props[1] as FurnitureType,
        tilesheetSize: split2[0] === '-1' ? -1 : { width: Number(split2[0]), height: Number(split2[1]) },
        boundingBoxSize: split3[0] === '-1' ? -1 : { width: Number(split3[0]), height: Number(split3[1]) },
        rotations: Number(props[4]),
        price: Number(props[5]),
        displayName: props[6],
        placementRestriction: Number(props[7]),
        sprite: GetSprite('Furniture', Number(key)),
        parentSheetIndex: Number(key),
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
        sprite: GetSprite('Hat', Number(key)),
        parentSheetIndex: Number(key),
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
        sprite: GetSprite('RangedWeapon', Number(key)),
        parentSheetIndex: Number(key),
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
            sprite: GetSprite('MeleeWeapon', Number(key)),
            parentSheetIndex: Number(key),
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
        sprite: GetSprite('Tool', Number(key)),
        parentSheetIndex: Number(key),
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
await copyFile(`./content/Characters/Farmer/accessories.png`, `./static/assets/accessories.png`);
// await copyFile(`./content/Characters/Farmer/farmer_base.png`, `./static/assets/farmer_base.png`);
// await copyFile(`./content/Characters/Farmer/farmer_base_bald.png`, `./static/assets/farmer_base_bald.png`);
// await copyFile(`./content/Characters/Farmer/farmer_girl_base.png`, `./static/assets/farmer_girl_base.png`);
// await copyFile(`./content/Characters/Farmer/farmer_girl_base_bald.png`, `./static/assets/farmer_girl_base_bald.png`);
await copyFile(`./content/Characters/Farmer/hairstyles.png`, `./static/assets/hairstyles.png`);
await copyFile(`./content/Characters/Farmer/hairstyles2.png`, `./static/assets/hairstyles2.png`);
await copyFile('./content/maps/springobjects.png', './static/assets/springobjects.png');
await copyFile('./content/Characters/Farmer/hats.png', './static/assets/hats.png');
await copyFile('./content/LooseSprites/daybg.png', './static/assets/daybg.png');

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