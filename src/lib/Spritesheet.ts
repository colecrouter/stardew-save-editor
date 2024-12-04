import { DefaultFurnitureSizes } from "$lib/ItemData";
import {
    FurnitureType,
    type ItemInformation,
    type Size,
} from "$types/items/1.6";

const ShirtsWithFemaleVariant = new Set<string>([
    "Plain Shirt",
    "Tank Top",
    "Crop Tank Top",
    "80's Shirt",
    "Basic Pullover",
    "Classy Top",
]);

export const GetSpritesheet = (lookupItem: ItemInformation): string => {
    if ("texture" in lookupItem && lookupItem.texture) {
        return lookupItem.texture.replace("TileSheets\\", "");
    }

    let spritesheet = "";
    switch (lookupItem._type) {
        case "Object":
        case "Boots":
            if (lookupItem.texture === "TileSheets\\Objects_2") {
                spritesheet = "Objects_2.png";
            } else {
                spritesheet = "springobjects.png";
            }
            break;
        case "BigCraftable":
            spritesheet = "Craftables.png";
            break;
        case "Pants":
            spritesheet = "pants.png";
            break;
        case "Shirt":
            spritesheet = "shirts.png";
            break;
        case "Hat":
            spritesheet = "hats.png";
            break;
        case "Furniture":
            spritesheet = "furniture.png";
            break;
        case "Weapon":
            spritesheet = "weapons.png";
            break;
        case "Tool":
            spritesheet = "tools.png";
            break;
    }

    return spritesheet;
};

export const IndexToSprite = (
    index: number,
    itemW: number,
    itemH: number,
    sheetW: number,
    sheetH: number,
    padRight = 0,
) => {
    const x = sheetW + padRight - ((index * itemW) % sheetW);
    const y = sheetH - Math.floor((index * itemW) / sheetW) * itemH;
    return { x, y };
};

export const GetSprite = (info: ItemInformation): { x: number; y: number } => {
    const index =
        "menuSpriteIndex" in info && info.menuSpriteIndex !== undefined
            ? info.menuSpriteIndex
            : (info.spriteIndex ?? Number(info.spriteIndex ?? info._key));
    console.log(info?.spriteIndex, info._key);
    if (Number.isNaN(index)) throw new Error("Invalid sprite index");

    const dyeable = "canBeDyed" in info && info.canBeDyed;
    switch (info._type) {
        case "Object":
            if (info.texture === "TileSheets\\Objects_2") {
                return IndexToSprite(index, 16, 16, 128, 320);
            }
            return IndexToSprite(index, 16, 16, 384, 624);
        case "BigCraftable":
            return IndexToSprite(index, 16, 32, 128, 1472);
        case "Boots":
            return IndexToSprite(index, 16, 16, 384, 624);
        case "Hat":
            return IndexToSprite(index, 20, 80, 240, 880);
        case "Pants": {
            // Special case, pants have 192x672 of animation frames, then the pants themselves are underneath on the left
            const pantSprite = IndexToSprite(index, 192, 686, 1920, 1376);
            return { x: pantSprite.x, y: pantSprite.y - 672 };
        }
        case "Shirt": {
            /*
                Shirts are a bit weird, because the sprite sheet is 256x608, but the shirts are 8x8,
                but it is split into two columns; one for regular shirts and one for dyeable shirts.
                When the shirt is dyeable, the sprite index is the same as the regular shirt, but the
                corresponding sprite is 128 pixels to the right.

            */
            const shirtSprite = IndexToSprite(index, 8, 32, 128, 608, 128);
            return dyeable
                ? { x: shirtSprite.x - 128, y: shirtSprite.y }
                : shirtSprite;
        }
        case "Furniture":
            return IndexToSprite(index, 16, 16, 512, 1488);
        case "Weapon":
            return IndexToSprite(index, 16, 16, 128, 144);
        case "Tool":
            return IndexToSprite(index, 16, 16, 336, 384);
        default:
            // @ts-expect-error
            console.warn("Unknown item type", lookupItem?._type);
            return { x: 0, y: 0 };
    }
};

export const GetSize = (info: ItemInformation): Size => {
    console.log(info);
    switch (info._type) {
        case "BigCraftable":
            return { width: 16, height: 32 };
        case "Shirt":
            return { width: 8, height: 8 };
        case "Hat":
            return { width: 20, height: 20 };
        case "Furniture": {
            if (info.tilesheetSize) {
                return {
                    width: info.tilesheetSize.width * 16,
                    height: info.tilesheetSize.height * 16,
                };
            }

            return (
                DefaultFurnitureSizes.get(info.type) ?? {
                    width: 16,
                    height: 16,
                }
            );
        }
        default:
            return { width: 16, height: 16 };
    }
};

export const GetPlayerSpriteForPants = (index: number, isMale: boolean) => {
    const { x, y } = IndexToSprite(index, 192, 688, 1920, 1376);
    return isMale ? { x, y } : { x: x - 96, y };
};
