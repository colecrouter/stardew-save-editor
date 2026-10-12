import dimensions from "$generated/dimensions.json";
import {
	type Coordinates,
	FurnitureType,
	type ItemInformation,
	type Size,
} from "$types/items";

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
	[FurnitureType.Lamp, { width: 16, height: 48 }],
	[FurnitureType.Decor, { width: 16, height: 32 }],
	[FurnitureType.Other, { width: 16, height: 32 }],
	[FurnitureType.Bookcase, { width: 32, height: 48 }],
	[FurnitureType.Table, { width: 32, height: 48 }],
	[FurnitureType.Rug, { width: 48, height: 32 }],
	[FurnitureType.Window, { width: 16, height: 32 }],
	[FurnitureType.Fireplace, { width: 32, height: 80 }],
	[FurnitureType.Bed, { width: 16, height: 32 }],
	[FurnitureType.Torch, { width: 16, height: 32 }],
	[FurnitureType.Sconce, { width: 16, height: 32 }],
]);

export class Sprite {
	private info: ItemInformation;

	readonly sheet: string;
	readonly sheetSize: Size;
	/** Menu sprite rectangle in the game's positive texture coordinates. */
	readonly sourceRect: Size & Coordinates;
	readonly index: number;

	constructor(info: ItemInformation) {
		this.info = info;

		try {
			this.sheet = this.getSpritesheet();
			this.sheetSize = this.getSpritesheetSize();
			this.index =
				"menuSpriteIndex" in info &&
				info.menuSpriteIndex != null &&
				info.menuSpriteIndex >= 0
					? info.menuSpriteIndex
					: (info.spriteIndex ?? Number(info._key));
			if (!Number.isInteger(this.index) || this.index < 0)
				throw new Error("Invalid sprite index");
			this.sourceRect = this.getSourceRect();
		} catch (e) {
			if (!(e instanceof Error)) throw e;
			console.error(
				new Error(`Failed to create sprite for ${info.name}`, {
					cause: e,
				}),
			);

			this.sheet = "springobjects.png";
			this.sheetSize = { width: 0, height: 0 };
			this.index = 0;
			this.sourceRect = { ...this.sheetSize, x: 0, y: 0 };
		}
	}

	/** Compatibility adapter for the character preview's repeating CSS backgrounds. */
	get dimensions(): Size & Coordinates {
		return {
			...this.sourceRect,
			x: this.sheetSize.width - this.sourceRect.x,
			y: this.sheetSize.height - this.sourceRect.y,
		};
	}

	private getSpritesheet() {
		if ("texture" in this.info && this.info.texture) {
			return this.info.texture;
		}

		return spritesheetDefaults.get(this.info._type) ?? "springobjects.png";
	}

	private getSpritesheetSize() {
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

			return (
				furnitureDefaultSizes.get(furnitureType) ?? { width: 16, height: 32 }
			);
		}
		if (this.info._type === "Mannequin") {
			return { width: 16, height: 32 };
		}

		return spriteDefaultSizes.get(this.info._type) ?? defaultSize;
	}

	/** Apply offsets to the index before resolving coordinates, so adjacent layers wrap rows. */
	getSourceRect(offset = 0): Size & Coordinates {
		const index = this.index + offset;
		const { width: sheetWidth } = this.sheetSize;
		const size = this.getSize();
		let position: Coordinates;
		switch (this.info._type) {
			case "Hat":
				// Each row contains four 20px directions per hat.
				position = Sprite.sourcePosition(index, 20, 80, sheetWidth);
				break;
			case "Pants":
				// PantsDataDefinition: 192px blocks, 688px stride, icon below 672px of animation.
				position = {
					x: 192 * (index % Math.floor(sheetWidth / 192)),
					y: 688 * Math.floor(index / Math.floor(sheetWidth / 192)) + 672,
				};
				break;
			case "Shirt":
				// The left half contains bases; the right half contains dye masks.
				position = Sprite.sourcePosition(index, 8, 32, sheetWidth / 2);
				break;
			case "Furniture":
				// Furniture indexes 16px cells, independently of the sprite's draw size.
				position = Sprite.sourcePosition(index, 16, 16, sheetWidth);
				break;
			default:
				if (!spritesheetSizes.has(this.sheet))
					throw new Error(`Invalid spritesheet ${this.sheet}`);
				position = Sprite.sourcePosition(
					index,
					size.width,
					size.height,
					sheetWidth,
				);
		}
		return { ...size, ...position };
	}

	private static sourcePosition(
		index: number,
		itemW: number,
		itemH: number,
		sheetW: number,
	) {
		return {
			x: (index * itemW) % sheetW,
			y: Math.floor((index * itemW) / sheetW) * itemH,
		};
	}

	static fromIndex(
		index: number,
		itemW: number,
		itemH: number,
		sheetW: number,
		sheetH: number,
		padRight = 0,
	) {
		const position = Sprite.sourcePosition(index, itemW, itemH, sheetW);
		return { x: sheetW + padRight - position.x, y: sheetH - position.y };
	}
}
