import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { GetSprite } from "./lib/Spritesheet.js";
import type {
    BigCraftable,
    Boots,
    Clothing,
    Furniture,
    FurnitureType,
    Hat,
    // biome-ignore lint/suspicious/noShadowRestrictedNames: lazy
    Object,
    Tool,
    Weapon,
} from "./types/items/1.6.js";

const objects = JSON.parse(
    await readFile("./content/Data/Objects.json", "utf-8"),
) as Record<string, Object>;
const objectsArray = Object.values(objects).map((obj) =>
    // There's a ton of "Stone" entries in objects, only use the one that has an id of 390
    obj.Name === "Stone" && obj.SpriteIndex !== 390
        ? undefined
        : { ...obj, _type: "Object" },
);

const bigCraftables = JSON.parse(
    await readFile("./content/Data/BigCraftables.json", "utf-8"),
) as Record<string, BigCraftable>;
const bigCraftablesArray = Object.values(bigCraftables).map((obj) => ({
    ...obj,
    _type: "BigCraftable",
}));

const boots = JSON.parse(
    await readFile("./content/Data/Boots.json", "utf-8"),
) as Record<string, string>;
const bootsArray = Object.entries(boots).map(([key, value]) => {
    const props = value.split("/");
    return {
        _type: "Boots",
        ItemId: Number(key),
        Name: props[0],
        Description: props[1],
        Price: Number(props[2]),
        Defense: Number(props[3]),
        Immunity: Number(props[4]),
        ColorIndex: Number(props[5]),
        DisplayName: props[6],
        Sprite: GetSprite("Boots", Number(key)),
        ParentSheetIndex: Number(key),
        Category: -97,
    } satisfies Boots;
});

const shirts = JSON.parse(
    await readFile("./content/Data/Shirts.json", "utf-8"),
) as Record<string, Clothing>;
const pants = JSON.parse(
    await readFile("./content/Data/Pants.json", "utf-8"),
) as Record<string, Clothing>;
const shirtsArray = Object.entries(shirts).map(([key, value], i) => ({
    ...value,
    id: key,
    _type: "Shirt",
    ParentSheetIndex: i,
    Type: "Shirt",
}));
const pantsArray = Object.entries(pants).map(([key, value], i) => ({
    ...value,
    id: key,
    _type: "Pants",
    ParentSheetIndex: i,
    Type: "Pants",
}));
const clothingArray = [...shirtsArray, ...pantsArray];

const furniture = JSON.parse(
    await readFile("./content/Data/Furniture.json", "utf-8"),
) as Record<string, string>;
const furnitureArray = Object.entries(furniture).map(([key, value]) => {
    const props = value.split("/");
    const split2 = props[2].split(" ");
    const split3 = props[3].split(" ");

    return {
        _type: "Furniture",
        ItemId: Number(key),
        Name: props[0],
        Type: props[1] as FurnitureType,
        TilesheetSize:
            split2[0] === "-1"
                ? -1
                : { width: Number(split2[0]), height: Number(split2[1]) },
        BoundingBoxSize:
            split3[0] === "-1"
                ? -1
                : { width: Number(split3[0]), height: Number(split3[1]) },
        Rotations: Number(props[4]),
        Price: Number(props[5]),
        DisplayName: props[6],
        Description: props[7],
        Sprite: GetSprite("Furniture", Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies Furniture;
});

const hats = JSON.parse(
    await readFile("./content/Data/hats.json", "utf-8"),
) as Record<string, string>;
const hatsArray = Object.entries(hats).map(([key, value], i) => {
    const props = value.split("/");
    return {
        _type: "Hat",
        ItemId: Number(key),
        Name: props[0],
        Description: props[1],
        ShowRealHair: props[2] === "true",
        SkipHairstyleOffset: props[3] === "true",
        DisplayName: props[4],
        Sprite: GetSprite("Hat", Number(key)),
        ParentSheetIndex: Number(key),
    } satisfies Hat;
});

const weapons = JSON.parse(
    await readFile("./content/Data/Weapons.json", "utf-8"),
) as Record<string, Weapon>;
const weaponsArray = Object.values(weapons).map((weapon) => ({
    ...weapon,
    _type: "Weapon",
}));
const tools = JSON.parse(
    await readFile("./content/Data/Tools.json", "utf-8"),
) as Record<string, Tool>;
const toolsArray = Object.values(tools).map((tool) => ({
    ...tool,
    _type: "Tool",
}));

const cookingRecipes = JSON.parse(
    await readFile("./content/Data/CookingRecipes.json", "utf-8"),
) as Record<string, string>;
const cookingRecipesArray = Object.entries(cookingRecipes).map(([key]) => key);
await writeFile(
    "./static/cookingrecipes.json",
    JSON.stringify(cookingRecipesArray),
);

const craftingRecipes = JSON.parse(
    await readFile("./content/Data/CraftingRecipes.json", "utf-8"),
) as Record<string, string>;
const craftingRecipesArray = Object.entries(craftingRecipes).map(
    ([key]) => key,
);
await writeFile(
    "./static/craftingrecipes.json",
    JSON.stringify(craftingRecipesArray),
);

const notUndefined = <T>(x: T | undefined): x is T => x !== undefined;
const writeToFile = JSON.stringify(
    [
        ...objectsArray,
        ...bigCraftablesArray,
        ...bootsArray,
        ...clothingArray,
        ...furnitureArray,
        ...hatsArray,
        ...weaponsArray,
        ...toolsArray,
    ]
        .filter(notUndefined)
        .map((item) => [item.Name, item]),
);
await writeFile("./static/iteminfo.json", writeToFile);

// Copy all textures into assets folder
await copyFile(
    "./content/TileSheets/Craftables.png",
    "./static/assets/Craftables.png",
);
await copyFile(
    "./content/TileSheets/furniture.png",
    "./static/assets/furniture.png",
);
await copyFile(
    "./content/TileSheets/weapons.png",
    "./static/assets/weapons.png",
);
await copyFile("./content/TileSheets/tools.png", "./static/assets/tools.png");
await copyFile(
    "./content/Characters/Farmer/pants.png",
    "./static/assets/pants.png",
);
await copyFile(
    "./content/Characters/Farmer/shirts.png",
    "./static/assets/shirts.png",
);
await copyFile(
    "./content/Characters/Farmer/accessories.png",
    "./static/assets/accessories.png",
);
await copyFile(
    "./content/Characters/Farmer/farmer_base.png",
    "./static/assets/farmer_base.png",
);
await copyFile(
    "./content/Characters/Farmer/farmer_base_bald.png",
    "./static/assets/farmer_base_bald.png",
);
await copyFile(
    "./content/Characters/Farmer/farmer_girl_base.png",
    "./static/assets/farmer_girl_base.png",
);
await copyFile(
    "./content/Characters/Farmer/farmer_girl_base_bald.png",
    "./static/assets/farmer_girl_base_bald.png",
);
await copyFile(
    "./content/Characters/Farmer/hairstyles.png",
    "./static/assets/hairstyles.png",
);
await copyFile(
    "./content/Characters/Farmer/hairstyles2.png",
    "./static/assets/hairstyles2.png",
);
await copyFile(
    "./content/Maps/springobjects.png",
    "./static/assets/springobjects.png",
);
await copyFile(
    "./content/Characters/Farmer/hats.png",
    "./static/assets/hats.png",
);
await copyFile("./content/LooseSprites/daybg.png", "./static/assets/daybg.png");

// Copy all portraits into assets folder
const chars = [
    "Abigail",
    "Alex",
    "Caroline",
    "Clint",
    "Demetrius",
    "Dwarf",
    "Elliott",
    "Emily",
    "Evelyn",
    "George",
    "Gus",
    "Haley",
    "Harvey",
    "Jas",
    "Jodi",
    "Kent",
    "Krobus",
    "Leah",
    "Lewis",
    "Linus",
    "Marnie",
    "Maru",
    "Pam",
    "Penny",
    "Pierre",
    "Robin",
    "Sam",
    "Sandy",
    "Sebastian",
    "Shane",
    "Vincent",
    "Willy",
    "Wizard",
];

// Create portraits folder if it doesn't exist
try {
    await mkdir("./static/assets/portraits");
} catch (e) { }

for (const char of chars) {
    await copyFile(
        `./content/Portraits/${char}.png`,
        `./static/assets/portraits/${char}.png`,
    );
}
