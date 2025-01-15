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
import { type ColorTag, colorMap } from "./colors";
import {
    type BigCraftable,
    type Boots,
    type Furniture,
    type FurnitureType,
    type Hat,
    ObjectCategory,
    type Pants,
    type PlacementRestriction,
    type RegularObject,
    type Shirt,
    type Size,
    type Tool,
    type ToolClass,
    type Weapon,
} from "./items";
import type { TypeEnum } from "./save";

const thrw = (msg: string): never => {
    throw new Error(msg);
};

const textureFilter = ["TileSheets", "/", "\\"];
const fixTexture = (texture: string | null | undefined) =>
    texture
        ? `${textureFilter.reduce(
              (acc, filter) => acc.replaceAll(filter, ""),
              texture,
          )}.png`
        : undefined;

const objectsArray = Object.entries(objects)
    .map(
        ([key, obj]) =>
            ({
                _type: "Object",
                _key: key,
                name: obj.Name,
                displayName: obj.DisplayName,
                description: obj.Description,
                price: obj.Price,
                type: obj.Type as TypeEnum,
                category: obj.Category,
                texture: fixTexture(obj.Texture),
                spriteIndex: obj.SpriteIndex,
                edibility: obj.Edibility,
                isDrink: obj.IsDrink,
                tags: obj.ContextTags ?? undefined,
                color: undefined,
            }) satisfies RegularObject,
    )
    // Hack for multiple unused stone objects
    .filter((obj) => obj.name !== "Stone" || obj._key === "390");

const smokedFish = objectsArray
    .filter((i) => i.category === ObjectCategory.Fish)
    .map((obj) => ({
        ...obj,
        name: `Smoked ${obj.name}`,
        edibility: Math.floor(obj.edibility * 1.5),
        price: Math.floor(obj.price * 2),
        category: ObjectCategory.ArtisanGoods,
    }));

const driedMushrooms = objectsArray
    .filter((i) => i.category === ObjectCategory.Forage)
    .filter((i) =>
        [
            "Chanterelle",
            "Common Mushroom",
            "Morel",
            "Magma Cap",
            "Purple Mushroom",
        ].includes(i.name),
    )
    .map((obj) => ({
        ...obj,
        name: `Dried ${obj.name}`,
        edibility: Math.max(0, Math.floor(obj.edibility * 3)),
        price: Math.floor((obj.price * 1.5 + 5) * 5),
        category: ObjectCategory.ArtisanGoods,
        texture: objectsArray.find((i) => i._key === "DriedMushrooms")?.texture,
        spriteIndex: objectsArray.find((i) => i._key === "DriedMushrooms")
            ?.spriteIndex,
        color: obj.tags
            ?.map((tag) => colorMap.get(tag as ColorTag))
            .find((color) => color !== undefined),
    }));

const driedFruit = objectsArray
    .filter((i) => i.category === ObjectCategory.Fruit)
    .filter((i) => i.name !== "Grapes")
    .map((obj) => ({
        ...obj,
        name: `Dried ${obj.name}`,
        edibility: Math.max(0, Math.floor(obj.edibility * 3)),
        price: Math.floor((obj.price * 1.5 + 5) * 5),
        category: ObjectCategory.ArtisanGoods,
        texture: objectsArray.find((i) => i._key === "DriedFruit")?.texture,
        spriteIndex: objectsArray.find((i) => i._key === "DriedFruit")
            ?.spriteIndex,
        color: obj.tags
            ?.map((tag) => colorMap.get(tag as ColorTag))
            .find((color) => color !== undefined),
    }));

const wine = objectsArray
    .filter((i) => i.category === ObjectCategory.Fruit)
    .map((obj) => ({
        ...obj,
        name: `${obj.name} Wine`,
        edibility: Math.min(0, Math.floor(obj.edibility * 1.75)),
        price: Math.floor(obj.price * 3),
        category: ObjectCategory.ArtisanGoods,
        texture: objectsArray.find((i) => i.name === "Wine")?.texture,
        spriteIndex: objectsArray.find((i) => i.name === "Wine")?.spriteIndex,
        color: obj.tags
            ?.map((tag) => colorMap.get(tag as ColorTag))
            .find((color) => color !== undefined),
    }));

const pickles = objectsArray
    .filter(
        (i) =>
            i.category === ObjectCategory.Vegetable ||
            (i.category === ObjectCategory.Forage && i.edibility > 0),
    )
    .filter((i) => [
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
    ])
    .map((obj) => ({
        ...obj,
        name: `Pickled ${obj.name}`,
        edibility: Math.max(
            0,
            obj.edibility ? Math.floor(obj.edibility * 1.75) : obj.price * 0.25,
        ),
        price: Math.floor(obj.price * 2.25),
        category: ObjectCategory.ArtisanGoods,
        texture: objectsArray.find((i) => i.name === "Pickles")?.texture,
        spriteIndex: objectsArray.find((i) => i.name === "Pickles")
            ?.spriteIndex,
        color: obj.tags
            ?.map((tag) => colorMap.get(tag as ColorTag))
            .find((color) => color !== undefined),
    }));

const jelly = objectsArray
    .filter((i) => i.category === ObjectCategory.Fruit)
    .map((obj) => ({
        ...obj,
        name: `${obj.name} Jelly`,
        edibility: Math.max(
            0,
            obj.edibility ? Math.floor(obj.edibility * 1.75) : obj.price * 0.2,
        ),
        price: Math.floor(obj.price * 2.25),
        category: ObjectCategory.ArtisanGoods,
        texture: objectsArray.find((i) => i.name === "Jelly")?.texture,
        spriteIndex: objectsArray.find((i) => i.name === "Jelly")?.spriteIndex,
        color: obj.tags
            ?.map((tag) => colorMap.get(tag as ColorTag))
            .find((color) => color !== undefined),
    }));

const juices = objectsArray
    .filter((i) =>
        [ObjectCategory.Fruit, ObjectCategory.Forage].includes(i.category),
    )
    .filter(
        (i) =>
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
    )
    .map((obj) => ({
        ...obj,
        name: `${obj.name} Juice`,
        edibility: Math.max(
            0,
            obj.edibility ? Math.floor(obj.edibility * 2) : obj.price * 1.4,
        ),
        price: Math.floor(obj.price * 2.25),
        category: ObjectCategory.ArtisanGoods,
        texture: objectsArray.find((i) => i.name === "Juice")?.texture,
        spriteIndex: objectsArray.find((i) => i.name === "Juice")?.spriteIndex,
        color: obj.tags
            ?.map((tag) => colorMap.get(tag as ColorTag))
            .find((color) => color !== undefined),
    }));

const bigCraftablesArray = Object.entries(bigCraftables).map(
    ([key, obj]) =>
        ({
            _type: "BigCraftable",
            _key: key,
            name: obj.Name,
            displayName: obj.DisplayName,
            description: obj.Description,
            price: obj.Price,
            fragility: obj.Fragility,
            canBePlacedIndoors: obj.CanBePlacedIndoors,
            canBePlacedOutdoors: obj.CanBePlacedOutdoors,
            isLamp: obj.IsLamp,
            texture: fixTexture(obj.Texture),
            spriteIndex: obj.SpriteIndex,
        }) satisfies BigCraftable,
);

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

const shirtsArray = Object.entries(shirts)
    .map(
        ([key, obj]) =>
            ({
                _type: "Shirt",
                _key: key,
                description: obj.Description,
                displayName: obj.DisplayName,
                name: obj.Name,
                defaultColor: obj.DefaultColor || undefined,
                canBeDyed: obj.CanBeDyed,
                isPrismatic: obj.IsPrismatic,
                hasSleeves: obj.HasSleeves,
                texture: fixTexture(obj.Texture),
                price: obj.Price,
                spriteIndex: obj.SpriteIndex,
            }) satisfies Shirt,
    )
    // Filter out "SoftEdgePullover"
    .filter((shirt) => shirt._key !== "SoftEdgePullover");

const pantsArray = Object.entries(pants).map(
    ([key, obj]) =>
        ({
            _type: "Pants",
            _key: key,
            description: obj.Description,
            displayName: obj.DisplayName,
            name: obj.Name,
            defaultColor: obj.DefaultColor || undefined,
            price: obj.Price,
            spriteIndex: obj.SpriteIndex,
            canBeDyed: obj.CanBeDyed,
            isPrismatic: obj.IsPrismatic,
            texture: fixTexture(obj.Texture),
        }) satisfies Pants,
);

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

const weaponsArray = Object.entries(weapons).map(
    ([key, obj]) =>
        ({
            _type: "Weapon",
            _key: key,
            name: obj.Name,
            displayName: obj.DisplayName,
            description: obj.Description,
            minDamage: obj.MinDamage,
            maxDamage: obj.MaxDamage,
            speed: obj.Speed,
            knockback: obj.Knockback,
            critChance: obj.CritChance,
            critMultiplier: obj.CritMultiplier,
            areaOfEffect: obj.AreaOfEffect,
            type: obj.Type,
            texture:
                fixTexture(obj.Texture) ?? thrw("Weapon must have a texture"),
            spriteIndex: obj.SpriteIndex,
            canBeLostOnDeath: obj.CanBeLostOnDeath,
            defense: obj.Defense,
            precision: obj.Precision,
            mineBaseLevel: obj.MineBaseLevel,
            mineMinLevel: obj.MineMinLevel,
        }) satisfies Weapon,
);

const toolsArray = Object.entries(tools).map(
    ([key, obj]) =>
        ({
            _type: "Tool",
            _key: key,
            name: obj.Name,
            displayName: obj.DisplayName,
            description: obj.Description,
            attachmentSlots:
                obj.AttachmentSlots === -1 ? undefined : obj.AttachmentSlots,
            salePrice: obj.SalePrice,
            texture:
                fixTexture(obj.Texture) ?? thrw("Tool must have a texture"),
            spriteIndex: obj.SpriteIndex,
            upgradeLevel: obj.UpgradeLevel,
            menuSpriteIndex:
                obj.MenuSpriteIndex === -1 ? undefined : obj.MenuSpriteIndex,
            class: obj.ClassName as ToolClass,
        }) satisfies Tool,
);

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

const notUndefined = <T>(x: T | undefined): x is T => x !== undefined;
const writeToFile = JSON.stringify(
    [
        ...objectsArray.filter(
            (i) => !["Dried", "Pickled", "Jelly", "Juice"].includes(i.name),
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

// Copy all textures into assets folder
// Copy assets
const filesToCopy = [
    "TileSheets/Craftables.png",
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

const farmAnimals = Object.entries(animals).map(([key, obj]) => ({
    name: obj.DisplayName,
    requiredBuilding: obj.RequiredBuilding,
    house: obj.House,
    canReproduce: obj.CanGetPregnant,
}));
await writeFile("./generated/farmanimals.json", JSON.stringify(farmAnimals));

const buildingsArray = Object.entries(buildings).map(([key, obj]) => ({
    name: key,
    size: obj.Size,
    maxOccupants: obj.MaxOccupants,
    hayCapacity: obj.HayCapacity,
}));
await writeFile("./generated/buildings.json", JSON.stringify(buildingsArray));
