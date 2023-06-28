import type { Clothing, ItemInformation } from "$types/items";
import type { HairstyleColor } from "$types/save/1.5";

export const GetSpritesheet = (lookupItem: ItemInformation): string => {
    let spritesheet = '';
    switch (lookupItem?._type) {
        case 'ObjectInformation':
        case 'Boots':
            spritesheet = 'springobjects.png';
            break;
        case 'BigCraftable':
            spritesheet = 'Craftables.png';
            break;
        case 'Hat':
            spritesheet = 'hats.png';
        case 'Clothing':
            switch (lookupItem._type) {
                case 'Clothing':
                    switch (lookupItem.type) {
                        case 'Pants':
                            spritesheet = 'pants.png';
                            break;
                        case 'Shirt':
                            spritesheet = 'shirts.png';
                            break;
                        default: // Accessory
                            throw new Error('Not real clothing type');
                            break;
                    }
                    break;
                case 'Hat':
                    spritesheet = 'hats.png';
                    break;
            }
            // TODO
            break;
        case 'Furniture':
            spritesheet = 'furniture.png';
            break;
        case 'RangedWeapon':
        case 'MeleeWeapon':
            spritesheet = 'weapons.png';
            break;
        case 'Tool':
            spritesheet = 'tools.png';
            break;
        default:
            // @ts-expect-error
            console.warn('Unknown item type', lookupItem?._type);
    };

    return spritesheet;
};

const IndexToSprite = (index: number, itemW: number, itemH: number, sheetW: number, sheetH: number, padRight: number = 0) => {
    const x = sheetW + padRight - ((index * itemW) % sheetW);
    const y = sheetH - (Math.floor((index * itemW) / sheetW) * itemH);
    return { x, y };
};

export const GetSprite = (type: ItemInformation['_type'], index: number, clothingType: Clothing['type'] | undefined = undefined): { x: number, y: number; } => {
    switch (type) {
        case 'ObjectInformation':
            return IndexToSprite(index, 16, 16, 384, 624);
        case 'BigCraftable':
            return IndexToSprite(index, 16, 32, 128, 1152);
        case 'Boots':
            return IndexToSprite(index, 16, 16, 384, 624);
        case 'Hat':
            return IndexToSprite(index, 20, 80, 240, 640);
        case 'Clothing':
            switch (clothingType) {
                case 'Pants':
                    // Special case, each pants sprite is 2x the height, BUT the pants are at the bottom, and not the top
                    const { x, y } = IndexToSprite(index, 64, 32, 1920, 1376);
                    return { x: x - 4, y: y - 22 };
                case 'Shirt':
                    return IndexToSprite(index - 1000, 8, 32, 128, 608, 128);
                default:
                    throw new Error('Not real clothing type');
            };
        case 'Furniture':
            return IndexToSprite(index, 16, 16, 512, 1488);
        case 'MeleeWeapon':
        case 'RangedWeapon':
            return IndexToSprite(index, 16, 16, 128, 144);
        case 'Tool':
            return IndexToSprite(index, 16, 16, 336, 384);
        default:
            // @ts-expect-error
            console.warn('Unknown item type', lookupItem?._type);
            return { x: 0, y: 0 };
    };
};

const IndexToSpriteShirts = (index: number) => {
    const sheetW = 128;
    const sheetH = 608;
    const itemW = 8;
    const itemH = 8;

    // We have to offset shirts by -1000 https://stardewvalleywiki.com/Modding:Items#Data_format_4
    index = index - 1000;

    const x = 0 - ((index * itemW) % sheetW);
    const y = sheetH - (Math.floor((index * itemH * 4) / sheetW) * itemH);

    return { x, y };
};

const IndexToSpritePants = (index: number) => {
    const sheetW = 1920;
    const sheetH = 1376;
    const itemW = 8;
    const itemH = 8;

    const x = 0 - (index * itemW * 12) % sheetW + (itemW * 1.5);
    const y = sheetH - Math.floor((index * itemH) / sheetW); // * (688) + (30);

    return { x, y };
};

const IndexToSpriteHats = (index: number) => {
    const sheetW = 240;
    const itemW = 20;

    const x = (index * itemW + itemW) % sheetW - 2;
    const y = Math.floor((index * itemW) / sheetW) * (itemW * 4) + itemW - 4;

    return { x, y };
};

const IndexToBigCraftables = (index: number) => {
    const sheetW = 128;
    const sheetH = 1152;
    const itemW = 16;
    const itemH = 32;

    const size = IndexToSprite(index, itemW, itemH, sheetW, sheetH);
};

const IndexToSpriteFurniture = (index: number) => {
    const sheetW = 512;
    const sheetH = 1488;
    const itemW = 16;
    const itemH = 16;

    return IndexToSprite(index, itemW, itemH, sheetW, sheetH);
};

export const HexToRGB = (hex: string): Partial<HairstyleColor> => {
    const R = parseInt(hex.slice(1, 3), 16);
    const G = parseInt(hex.slice(3, 5), 16);
    const B = parseInt(hex.slice(5, 7), 16);

    return { R, G, B };
};

export const RGBToHex = (rgb: HairstyleColor): string => {
    const { R, B, G } = rgb;

    const hex = ((R << 16) | (G << 8) | B).toString(16);

    return '#' + new Array(Math.abs(hex.length - 7)).join('0') + hex;
};