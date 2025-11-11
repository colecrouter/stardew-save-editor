import type bigCraftables from "../content/Data/BigCraftables.json";
import type mannequins from "../content/Data/Mannequins.json";
import objects from "../content/Data/Objects.json";
import type pants from "../content/Data/Pants.json";
import type shirts from "../content/Data/Shirts.json";
import type tools from "../content/Data/Tools.json";
import type trinkets from "../content/Data/Trinkets.json";
import type weapons from "../content/Data/Weapons.json";
import { colorMap } from "./colors";
import {
	ObjectCategory as Category,
	type ItemInformation,
	type RegularObject,
} from "./items";
import type { TypeEnum } from "./save";

/** Helper function to throw from outside closures
 * @throws Always throws an error with the given message
 */
export const thrw = (msg: string): never => {
	throw new Error(msg);
};

type Values<T> = T[keyof T];
type JSONImports =
	| Values<typeof objects>
	| Values<typeof bigCraftables>
	| Values<typeof shirts>
	| Values<typeof pants>
	| Values<typeof weapons>
	| Values<typeof tools>
	| Values<typeof trinkets>
	| Values<typeof mannequins>;

// Make Object.entries typesafe
declare global {
	interface ArrayConstructor {
		entries<T>(arr: T[]): Array<[number, T]>;
	}
}

/**

    There are two types of data formats for the game. The first (older) is a Record<string, string>, like so:
    ```json    
    {
        "16": "Trucker Hat/Mesh in the back to keep your head cool./false/true//Trucker Hat",
    }
    ```
    And the other like so:
    ```json
    {
        "1": {
            "Name": "Shorts",
            "Price": 50,
            ...
        },
    }
    ```

    The first format needs to be parsed by hand. This function handles the second format.

    @param data Directly imported JSON data (e.g. /content/Data/Objects.json)
    @param itemType The type of item to transform the data into
*/
export const transformJSONItems = <
	T extends Omit<ItemInformation["_type"], "Furniture">,
>(
	data: Record<string, JSONImports>,
	itemType: T,
) =>
	Object.entries(data).map(
		([key, obj]) =>
			({
				// @ts-expect-error Furniture type doesn't match and I'm getting tired of this
				_type: itemType,
				_key: key,
				name: "Name" in obj ? obj.Name : obj.ID, // TODO refactor name to be optional in ItemInformation
				displayName: obj.DisplayName,
				description: obj.Description,
				price: "Price" in obj ? obj.Price : undefined,
				type: "Type" in obj ? (obj.Type as TypeEnum) : undefined,
				category: "Category" in obj ? (obj.Category as Category) : undefined,
				texture: fixTexture(obj.Texture),
				spriteIndex:
					"SpriteIndex" in obj
						? obj.SpriteIndex
						: "SheetIndex" in obj
							? obj.SheetIndex
							: undefined,
				menuSpriteIndex:
					"MenuSpriteIndex" in obj ? obj.MenuSpriteIndex : undefined,
				upgradeLevel: "UpgradeLevel" in obj ? obj.UpgradeLevel : undefined,
				attachmentSlots:
					"AttachmentSlots" in obj && obj.AttachmentSlots !== -1
						? obj.AttachmentSlots
						: undefined,
				class: "ClassName" in obj ? obj.ClassName : undefined,
				defense: "Defense" in obj ? obj.Defense : undefined,
				immunity: "Immunity" in obj ? obj.Immunity : undefined,
				canBeDyed: "CanBeDyed" in obj ? obj.CanBeDyed : undefined,
				isPrismatic: "IsPrismatic" in obj ? obj.IsPrismatic : undefined,
				showRealHair: "ShowRealHair" in obj ? obj.ShowRealHair : undefined,
				skipHairstyleOffset:
					"SkipHairstyleOffset" in obj ? obj.SkipHairstyleOffset : undefined,
				tilesheetSize: "TilesheetSize" in obj ? obj.TilesheetSize : undefined,
				boundingBoxSize:
					"BoundingBoxSize" in obj ? obj.BoundingBoxSize : undefined,
				rotations: "Rotations" in obj ? obj.Rotations : undefined,
				placementRestriction:
					"PlacementRestriction" in obj ? obj.PlacementRestriction : undefined,
				defaultColor: ("DefaultColor" in obj && obj.DefaultColor) || undefined,
				offLimitsForRandomSale:
					"OffLimitsForRandomSale" in obj
						? obj.OffLimitsForRandomSale
						: undefined,
				salePrice: "SalePrice" in obj ? obj.SalePrice : undefined,
				canBePlacedIndoors:
					"CanBePlacedIndoors" in obj ? obj.CanBePlacedIndoors : undefined,
				canBePlacedOutdoors:
					"CanBePlacedOutdoors" in obj ? obj.CanBePlacedOutdoors : undefined,
				isLamp: "IsLamp" in obj ? obj.IsLamp : undefined,
				hasSleeves: "HasSleeves" in obj ? obj.HasSleeves : undefined,
				edibility: "Edibility" in obj ? obj.Edibility : undefined,
				tags: ("ContextTags" in obj && obj.ContextTags) || undefined,
				minDamage: "MinDamage" in obj ? obj.MinDamage : undefined,
				maxDamage: "MaxDamage" in obj ? obj.MaxDamage : undefined,
				speed: "Speed" in obj ? obj.Speed : undefined,
				knockback: "Knockback" in obj ? obj.Knockback : undefined,
				critChance: "CritChance" in obj ? obj.CritChance : undefined,
				critMultiplier:
					"CritMultiplier" in obj ? obj.CritMultiplier : undefined,
				areaOfEffect: "AreaOfEffect" in obj ? obj.AreaOfEffect : undefined,
				precision: "Precision" in obj ? obj.Precision : undefined,
			}) satisfies ItemInformation,
	);

interface ArtisanConfig {
	filter: (obj: RegularObject) => boolean;
	suffix?: string;
	prefix?: string;
	keepTexture?: boolean;
	edibilityMultiplier: number;
	tinted?: boolean;
	priceFunc: (
		obj: Pick<RegularObject, "_key" | "price" | "edibility">,
	) => number;
}

/**
 * In 1.6, many "generic" artisan goods were added. For example, previously you had "Wine", now you have "Grape Wine", "Blueberry Wine", etc.
 * These are generated at runtime, however, and are not present in the game's data files. This function generates them.
 *
 * @param artisanProduct The data for the item to create (e.g. "Wine")
 * @param config Configuration for the artisan goods
 * @returns An array of item data, can be included alongside Objects.json items
 */
export const createArtisanGoods = (
	artisanProduct: ItemInformation,
	config: ArtisanConfig,
) =>
	transformJSONItems(objects, "Object")
		// @ts-expect-error
		.filter(config.filter)
		.map((obj) => ({
			...obj,
			_key: artisanProduct._key,
			name: `${config.prefix ? `${config.prefix} ` : ""}${obj.name}${config.suffix ? ` ${config.suffix}` : ""}`,
			edibility: Math.max(
				0,
				Math.floor((obj.edibility ?? 0) * config.edibilityMultiplier),
			),
			price: config.priceFunc(obj),
			category: Category.ArtisanGoods,
			texture: config.keepTexture ? obj.texture : artisanProduct.texture,
			spriteIndex: config.keepTexture
				? obj.spriteIndex
				: artisanProduct.spriteIndex,
			color: config.tinted
				? obj.tags
						?.map((tag) => colorMap.get(tag))
						.find((color) => color !== undefined)
				: undefined,
			unpreservedItemId: obj._key,
			preservedItemName: artisanProduct.name,
		}));

const textureFilter = ["TileSheets", "/", "\\"];

/** Removes the "TileSheets\\\\" prefix and adds the ".png" suffix to a texture path */
export const fixTexture = (texture: string | null | undefined) =>
	texture
		? `${textureFilter.reduce(
				(acc, filter) => acc.replaceAll(filter, ""),
				texture,
			)}.png`
		: undefined;
