import type { Clothing, ItemInformation } from "$types/items/1.6";
import type { HairstyleColor } from "$types/save/1.5";

const ShirtsWithFemaleVariant = new Set<string>([
    "Plain Shirt",
    "Tank Top",
    "Crop Tank Top",
    "80's Shirt",
    "Basic Pullover",
    "Classy Top",
]);

const ShirtsWithMessedUpSpriteIndex = new Map<number, { x: number; y: number }>(
    [
        [1997, { x: 256, y: 64 }],
        [1998, { x: 256, y: 0 }],
    ],
);

export const GetSpritesheet = (lookupItem: ItemInformation): string => {
    let spritesheet = "";
    switch (lookupItem._type) {
        case "Object":
        case "Boots":
            if (lookupItem.Texture === "TileSheets\\Objects_2") {
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

export const GetSprite = (
    info: Pick<ItemInformation, "_type" | "Texture">,
    index: number,
    dyeable: boolean | undefined = undefined,
): { x: number; y: number } => {
    switch (info._type) {
        case "Object":
            if (info.Texture === "TileSheets\\Objects_2") {
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
            // let shirtSprite = ShirtsWithMessedUpSpriteIndex.get(index);
            // if (shirtSprite) { return shirtSprite; }
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

export const GetPlayerSpriteForPants = (index: number, isMale: boolean) => {
    const { x, y } = IndexToSprite(index, 192, 688, 1920, 1376);
    return isMale ? { x, y } : { x: x - 96, y };
};

export const HexToRGB = (hex: string): HairstyleColor => {
    const R = Number.parseInt(hex.slice(1, 3), 16);
    const G = Number.parseInt(hex.slice(3, 5), 16);
    const B = Number.parseInt(hex.slice(5, 7), 16);

    console.log(PackedValue(R, G, B, 255));
    return PackedValue(R, G, B, 255);
};

export const RGBToHex = (rgb: HairstyleColor): string => {
    const { R, B, G } = rgb;

    const hex = ((R << 16) | (G << 8) | B).toString(16);

    return `#${new Array(Math.abs(hex.length - 7)).join("0")}${hex}`;
};

export const PackedValue = (
    red: number,
    green: number,
    blue: number,
    alpha = 255,
) => {
    // Ensure the values are within the valid range
    const r = Math.max(0, Math.min(255, red));
    const g = Math.max(0, Math.min(255, green));
    const b = Math.max(0, Math.min(255, blue));

    // Combine the values into a single integer
    const packedValue = (r << 16) | (g << 8) | b;
    return {
        R: r,
        G: g,
        B: b,
        A: alpha,
        PackedValue: packedValue,
    } as HairstyleColor;
};
