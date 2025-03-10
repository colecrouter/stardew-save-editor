import { imageDimensionsFromData } from "image-dimensions";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import bigCraftables from "../content/Data/BigCraftables.json";
import boots from "../content/Data/Boots.json";
import buildings from "../content/Data/Buildings.json";
import animals from "../content/Data/FarmAnimals.json";
import furniture from "../content/Data/Furniture.json";
import objects from "../content/Data/Objects.json";
import pants from "../content/Data/Pants.json";
import shirts from "../content/Data/Shirts.json";
import tools from "../content/Data/Tools.json";
import weapons from "../content/Data/Weapons.json";
import hats from "../content/Data/hats.json";
import { characters } from "../src/lib/NPCs";
import {
    createArtisanGoods,
    fixTexture,
    thrw,
    transformJSONItems,
} from "./helpers";
import {
    type Boots,
    ObjectCategory as Category,
    type Furniture,
    type FurnitureType,
    type Hat,
    type PlacementRestriction,
    type RegularObject,
    type Size,
} from "./items";

// **Items**

const objectsArray = transformJSONItems(objects, "Object")
    // Hack for multiple unused stone objects
    .filter((obj) => obj.name !== "Stone" || obj._key === "390");

const bigCraftablesArray = transformJSONItems(bigCraftables, "BigCraftable");

const bootsArray = Object.entries(boots).map(([key, obj]) => {
    // 0 - name, 1 - description, 2 - price, 3 - defense, 4 - immunity, 5 - color index, 6 - display name, 7 - color texture, 8 - sprite index, 9 - texture name
    const props = obj.split("/");
    return {
        _type: "Boots",
        _key: key,
        name: props[0] ?? thrw("Boots must have a name"),
        description: props[1] ?? thrw("Boots must have a description"),
        defense: Number(props[3] ?? thrw("Boots must have a defense value")),
        immunity: Number(props[4] ?? thrw("Boots must have an immunity value")),
        colorIndex: Number(props[5] ?? thrw("Boots must have a color index")),
        displayName: props[6] ?? thrw("Boots must have a display name"),
    } satisfies Boots;
});

const shirtsArray = transformJSONItems(shirts, "Shirt").filter(
    (shirt) => shirt.name !== "Soft Edge Pullover",
);

const pantsArray = transformJSONItems(pants, "Pants");

const furnitureArray = Object.entries(furniture).map(([key, obj]) => {
    // 0 - name, 1 - type, 2 - tilesheet size, 3 - bounding box size, 4 - rotations, 5 - price, 6 - placement restriction, 7 - display name, 8 - sprite index, 9 - texture, 10 - off limits for random sale, 11 - tags
    const props = obj.split("/");
    const placementRestriction = props[6] === "" ? -1 : Number(props[6]);
    const tilesheetSplit = props[2]?.split(" ");
    const boundingBoxSplit = props[3]?.split(" ");
    const tilesheetSize =
        tilesheetSplit?.[0] === "-1"
            ? undefined
            : {
                  width: Number(tilesheetSplit?.[0]),
                  height: Number(tilesheetSplit?.[1]),
              };
    const boundingBoxSize =
        boundingBoxSplit?.[0] === "-1"
            ? undefined
            : {
                  width: Number(boundingBoxSplit?.[0]),
                  height: Number(boundingBoxSplit?.[1]),
              };

    return {
        _type: "Furniture",
        _key: key,
        name: props[0] ?? thrw("Furniture must have a name"),
        type: props[1] as FurnitureType,
        tilesheetSize,
        boundingBoxSize,
        rotations: Number(
            props[4] ?? thrw("Furniture must have a rotation count"),
        ),
        price: Number(props[5] ?? thrw("Furniture must have a price")),
        placementRestriction: placementRestriction as PlacementRestriction,
        displayName: props[7] ?? thrw("Furniture must have a display name"),
        texture: fixTexture(props[9]),
        spriteIndex: props[8] ? Number(props[8]) : undefined,
        offLimitsForRandomSale: props[10] === "true",
    } satisfies Furniture;
});

const hatsArray = Object.entries(hats).map(([key, obj]) => {
    // 0 - name, 1 - description, 2 - show real hair, 3 - skip hairstyle offset, 4 - tags, 5 - display name, 6 - sprite index, 7 - texture name
    const props = obj.split("/");
    return {
        _type: "Hat",
        _key: key,
        name: props[0] ?? thrw("Hat must have a name"),
        description: props[1] ?? thrw("Hat must have a description"),
        showRealHair: props[2] === "true",
        skipHairstyleOffset: props[3] === "true",
        displayName: props[5] ?? thrw("Hat must have a display name"),
        spriteIndex: props[6] ? Number(props[6]) : undefined,
        texture: fixTexture(props[7]),
    } satisfies Hat;
});

const weaponsArray = transformJSONItems(weapons, "Weapon");

const toolsArray = transformJSONItems(tools, "Tool");

// **Artisan Goods**

const smokedFish = createArtisanGoods(
    objectsArray.find((i) => i.name === "Smoked") as RegularObject,
    {
        filter: (i) => i.category === Category.Fish,
        prefix: "Smoked",
        edibilityMultiplier: 1.5,
        keepTexture: true,
        priceFunc: (obj) => Math.floor((obj.price ?? 0) * 2),
    },
);

const driedMushrooms = createArtisanGoods(
    objectsArray.find((i) => i._key === "DriedMushrooms") as RegularObject,
    {
        filter: (i) =>
            i.category === Category.Forage &&
            [
                "Chanterelle",
                "Common Mushroom",
                "Morel",
                "Magma Cap",
                "Purple Mushroom",
            ].includes(i.name),
        prefix: "Dried",
        edibilityMultiplier: 3,
        tinted: true,
        priceFunc: (obj) => Math.floor((obj.price ?? 0) * 1.5 + 5) * 5,
    },
);

const driedFruit = createArtisanGoods(
    objectsArray.find((i) => i._key === "DriedFruit") as RegularObject,
    {
        filter: (i) => i.category === Category.Fruit && i.name !== "Grapes",
        prefix: "Dried",
        edibilityMultiplier: 3,
        tinted: true,
        priceFunc: (obj) => Math.floor((obj.price ?? 0) * 1.5 + 5) * 5,
    },
);

const wine = createArtisanGoods(
    objectsArray.find((i) => i.name === "Wine") as RegularObject,
    {
        filter: (i) => i.category === Category.Fruit,
        suffix: "Wine",
        edibilityMultiplier: 1.75,
        tinted: true,
        priceFunc: (obj) => Math.floor((obj.price ?? 0) * 3),
    },
);

const pickles = createArtisanGoods(
    objectsArray.find((i) => i.name === "Pickles") as RegularObject,
    {
        filter: (i) =>
            (i.category === Category.Vegetable ||
                (i.category === Category.Forage && (i.edibility ?? 0) > 0)) &&
            ![
                "Cave Carrot",
                "Chanterelle",
                "Common Mushroom",
                "Dandelion",
                "Ginger",
                "Hazelnut",
                "Leek",
                "Magma Cap",
                "Morel",
                "Purple Mushroom",
                "Snow Yam",
                "Spring Onion",
                "Wild Horseradish",
                "Winter Root",
            ].includes(i.name),
        prefix: "Pickled",
        edibilityMultiplier: 1.75,
        tinted: true,
        priceFunc: (obj) => Math.floor((obj.price ?? 0) * 2.25),
    },
);

const jelly = createArtisanGoods(
    objectsArray.find((i) => i.name === "Jelly") as RegularObject,
    {
        filter: (i) => i.category === Category.Fruit,
        suffix: "Jelly",
        edibilityMultiplier: 1.75,
        tinted: true,
        priceFunc: (obj) => Math.floor((obj.price ?? 0) * 2.25),
    },
);

const juices = createArtisanGoods(
    objectsArray.find((i) => i.name === "Juice") as RegularObject,
    {
        filter: (i) =>
            [Category.Fruit, Category.Forage].includes(i.category) &&
            ![
                "Chanterelle",
                "Common Mushroom",
                "Magma Cap",
                "Morel",
                "Purple Mushroom",
                "Red Mushroom",
                "Wheet",
                "Hops",
                "Tea Leaves",
            ].includes(i.name),
        suffix: "Juice",
        edibilityMultiplier: 2,
        tinted: true,
        priceFunc: (obj) => Math.floor((obj.price ?? 0) * 2.25),
    },
);

const notUndefined = <T>(x: T | undefined): x is T => x !== undefined;
const writeToFile = JSON.stringify(
    [
        ...objectsArray.filter(
            (obj) =>
                !["Dried", "Pickled", "Juice", "Jelly", "Smoked"].includes(
                    obj.name,
                ),
        ),
        ...bigCraftablesArray,
        ...bootsArray,
        ...shirtsArray,
        ...pantsArray,
        ...furnitureArray,
        ...hatsArray,
        ...weaponsArray,
        ...toolsArray,
        ...smokedFish,
        ...driedMushrooms,
        ...driedFruit,
        ...wine,
        ...pickles,
        ...jelly,
        ...juices,
    ]
        .filter(notUndefined)
        .map((item) => [item.name, item]),
);
await writeFile("./generated/iteminfo.json", writeToFile);

// **Recipes**

const cookingRecipes = JSON.parse(
    await readFile("./content/Data/CookingRecipes.json", "utf-8"),
) as Record<string, string>;
const cookingRecipesArray = Object.entries(cookingRecipes).map(([key]) => key);
await writeFile(
    "./generated/cookingrecipes.json",
    JSON.stringify(cookingRecipesArray),
);

const craftingRecipes = JSON.parse(
    await readFile("./content/Data/CraftingRecipes.json", "utf-8"),
) as Record<string, string>;
const craftingRecipesArray = Object.entries(craftingRecipes).map(
    ([key]) => key,
);
await writeFile(
    "./generated/craftingrecipes.json",
    JSON.stringify(craftingRecipesArray),
);

// **Assets**

// Copy all textures into assets folder
// Copy assets
const filesToCopy = [
    "TileSheets/Craftables.png",
    "TileSheets/FreeCactuses.png",
    "TileSheets/furniture.png",
    "TileSheets/furniture_2.png",
    "TileSheets/furniture_3.png",
    "TileSheets/joja_furniture.png",
    "TileSheets/junimo_furniture.png",
    "TileSheets/retro_furniture.png",
    "TileSheets/wizard_furniture.png",
    "TileSheets/weapons.png",
    "TileSheets/tools.png",
    "Characters/Farmer/pants.png",
    "Characters/Farmer/shirts.png",
    "Characters/Farmer/accessories.png",
    "Characters/Farmer/hairstyles.png",
    "Characters/Farmer/hairstyles2.png",
    "Characters/Farmer/hats.png",
    "Maps/springobjects.png",
    "TileSheets/Objects_2.png",
    "LooseSprites/daybg.png",
    "LooseSprites/JunimoNote.png",
    "LooseSprites/font_colored.png",
    // Add any additional files you need to copy here
] as string[];

// Ensure the assets directory exists
await mkdir("./static/assets", { recursive: true });

// Copy files concurrently
let dimensions = new Map<string, Size>();
await Promise.all(
    filesToCopy.map(async (src) => {
        const filename = src.split("/").pop();
        await copyFile(`./content/${src}`, `./static/assets/${filename}`);
        dimensions.set(
            filename ?? thrw("Filename not found"),
            imageDimensionsFromData(await readFile(`./content/${src}`)) ??
                thrw("Dimensions not found"),
        );
    }),
);
await writeFile(
    "./generated/dimensions.json",
    JSON.stringify([...dimensions].sort(([a], [b]) => a.localeCompare(b))),
);

// Copy all portraits into assets folder
// Create portraits folder if it doesn't exist
try {
    await mkdir("./static/assets/portraits");
} catch (e) {}

for (const char of characters) {
    await copyFile(
        `./content/Portraits/${char}.png`,
        `./static/assets/portraits/${char}.png`,
    );
}

// **Farm Animals**

const farmAnimals = Object.entries(animals).map(([key, obj]) => ({
    name: obj.DisplayName,
    requiredBuilding: obj.RequiredBuilding,
    house: obj.House,
    canReproduce: obj.CanGetPregnant,
}));
await writeFile("./generated/farmanimals.json", JSON.stringify(farmAnimals));

// **Buildings**

const buildingsArray = Object.entries(buildings).map(([key, obj]) => ({
    name: key,
    size: obj.Size,
    maxOccupants: obj.MaxOccupants,
    hayCapacity: obj.HayCapacity,
}));
await writeFile("./generated/buildings.json", JSON.stringify(buildingsArray));
