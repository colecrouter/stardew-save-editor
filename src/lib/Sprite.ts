import type { Farmer } from "$lib/proxies/Farmer";
import {
    type Coordinates,
    FurnitureType,
    type ItemInformation,
    type Size,
} from "$types/items/1.6";
import { Gender } from "$types/save/1.6";
import dimensions from "../../static/dimensions.json";

const defaultSize = { width: 16, height: 16 } satisfies Size;

const spritesheetSizes = new Map<string, Size>(dimensions as [string, Size][]);

const spritesheetDefaults = new Map<ItemInformation["_type"], string>([
    ["Object", "springobjects.png"],
    ["Boots", "springobjects.png"],
    ["BigCraftable", "Craftables.png"],
    ["Pants", "pants.png"],
    ["Shirt", "shirts.png"],
    ["Hat", "hats.png"],
    ["Furniture", "furniture.png"],
    ["Weapon", "weapons.png"],
    ["Tool", "tools.png"],
]);

const spriteDefaultSizes = new Map<ItemInformation["_type"], Size>([
    ["BigCraftable", { width: 16, height: 32 }],
    ["Shirt", { width: 8, height: 8 }],
    ["Hat", { width: 20, height: 20 }],
    // Else default to 16x16
]);

const furnitureDefaultSizes = new Map<FurnitureType, Size>([
    [FurnitureType.Chair, { width: 16, height: 32 }],
    [FurnitureType.Bench, { width: 32, height: 32 }],
    [FurnitureType.Couch, { width: 48, height: 32 }],
    [FurnitureType.Armchair, { width: 32, height: 32 }],
    [FurnitureType.Dresser, { width: 32, height: 32 }],
    [FurnitureType.LongTable, { width: 80, height: 48 }],
    [FurnitureType.Painting, { width: 32, height: 32 }],
    [FurnitureType.Lamp, { width: 16, height: 32 }],
    [FurnitureType.Decor, { width: 16, height: 32 }],
    [FurnitureType.Other, defaultSize],
    [FurnitureType.Bookcase, { width: 32, height: 48 }],
    [FurnitureType.Table, { width: 32, height: 48 }],
    [FurnitureType.Rug, { width: 48, height: 32 }],
    [FurnitureType.Window, { width: 16, height: 32 }],
    [FurnitureType.Fireplace, { width: 32, height: 80 }],
    [FurnitureType.Bed, { width: 48, height: 64 }],
    [FurnitureType.Torch, { width: 16, height: 32 }],
    [FurnitureType.Sconce, defaultSize],
]);

export class Sprite {
    private info: ItemInformation;
    private player: Farmer | undefined;

    readonly sheet: string;
    readonly sheetSize: Size;
    readonly dimensions: Size & Coordinates;

    constructor(info: ItemInformation, player?: Farmer) {
        this.info = info;
        this.player = player;

        try {
            this.sheet = this.getSpritesheet();
            this.sheetSize = this.getSpritesheetSize();
            this.dimensions = { ...this.getSize(), ...this.getSprite() };
        } catch (e) {
            console.error("Failed to create sprite for", info.name);

            this.sheet = "springobjects.png";
            this.sheetSize = { width: 0, height: 0 };
            this.dimensions = { ...this.sheetSize, x: 0, y: 0 };
        }
    }

    private getSpritesheet() {
        if ("texture" in this.info && this.info.texture) {
            return this.info.texture;
        }

        return spritesheetDefaults.get(this.info._type) ?? "springobjects.png";
    }

    private getSpritesheetSize() {
        if ("texture" in this.info && this.info.texture) {
            return spritesheetSizes.get(this.info.texture) ?? defaultSize;
        }

        return spritesheetSizes.get(this.sheet) ?? defaultSize;
    }

    private getSize() {
        if (this.info._type === "Furniture") {
            const furnitureType = this.info.type;
            const explicitSize = this.info.tilesheetSize;
            if (explicitSize) {
                const newWidth = explicitSize.width * 16;
                const newHeight = explicitSize.height * 16;
                return { width: newWidth, height: newHeight };
            }

            return furnitureDefaultSizes.get(furnitureType) ?? defaultSize;
        }

        return spriteDefaultSizes.get(this.info._type) ?? defaultSize;
    }

    private getSprite() {
        const index =
            "menuSpriteIndex" in this.info &&
            this.info.menuSpriteIndex !== undefined
                ? this.info.menuSpriteIndex
                : (this.info.spriteIndex ??
                  Number(this.info.spriteIndex ?? this.info._key));
        if (Number.isNaN(index)) throw new Error("Invalid sprite index");

        const dyeable = "canBeDyed" in this.info && this.info.canBeDyed;
        switch (this.info._type) {
            case "Hat":
                // Hats are 20x20, but the sprite sheet is 20x80 for 4 directions
                return Sprite.indexToSprite(index, 20, 80, 240, 880);
            case "Pants": {
                // Special case, pants have 192x672 of animation frames, then the pants themselves are underneath on the left
                const pantSprite = Sprite.indexToSprite(
                    index,
                    192,
                    686, // I don't know if this math checks out, but it seems to work ok?
                    1920,
                    1376,
                );
                const isFemale = this.player?.gender === Gender.Female;
                return {
                    // Female pants variants are in the second half of the sheet
                    x: pantSprite.x - (isFemale ? 96 : 0),
                    y: pantSprite.y - 672,
                };
            }
            case "Shirt": {
                /*
                Shirts are a bit weird, because the sprite sheet is 256x608, but the shirts are 8x8,
                but it is split into two columns; one for regular shirts and one for dyeable shirts.
                When the shirt is dyeable, the sprite index is the same as the regular shirt, but the
                corresponding sprite is 128 pixels to the right.

            */
                const shirtSprite = Sprite.indexToSprite(
                    index,
                    8,
                    32,
                    128,
                    608,
                    128,
                );
                return dyeable
                    ? { x: shirtSprite.x - 128, y: shirtSprite.y }
                    : shirtSprite;
            }
            default: {
                const sheet = this.sheet;
                const sheetSize = spritesheetSizes.get(sheet);
                if (!sheetSize) throw new Error(`Invalid spritesheet ${sheet}`);
                const { width, height } = this.getSize();

                // Not sure what this is about
                const newWidth = sheet.search("furniture") !== -1 ? 16 : width;
                const newHeight =
                    sheet.search("furniture") !== -1 ? 16 : height;

                return Sprite.indexToSprite(
                    index,
                    newWidth,
                    newHeight,
                    sheetSize.width,
                    sheetSize.height,
                );
            }
        }
    }

    static indexToSprite(
        index: number,
        itemW: number,
        itemH: number,
        sheetW: number,
        sheetH: number,
        padRight = 0,
    ) {
        const x = sheetW + padRight - ((index * itemW) % sheetW);
        const y = sheetH - Math.floor((index * itemW) / sheetW) * itemH;
        return { x, y };
    }
}
