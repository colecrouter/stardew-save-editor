import {
	CategoriesWithQuality,
	FishingRodSpriteIndex,
	FishingRodUpgradeNumber,
	FurnitureTypeToNumber,
	ItemData,
	ItemNameHelper,
	KeyToName,
	RingsUniqueID,
	Shirts,
} from "$lib/ItemData";
import type { ParentIndex } from "$lib/ItemParentIndex";
import { Sprite } from "$lib/Sprite.svelte";
import { Color } from "$lib/proxies/Color.svelte";
import {
	FurnitureType,
	type ItemInformation,
	ObjectCategory,
	type ToolClass,
} from "$types/items";
import { ClothesType, type Item as ItemModel, TypeEnum } from "$types/save";
import * as Sentry from "@sentry/sveltekit";
import { type DataProxy, Raw } from ".";

const nil = { "@_xsi:nil": "true" };

// Mapping of data types to item types
const typeToItemTypeMap = new Map<ItemInformation["_type"], string>([
	["Object", "Object"],
	["BigCraftable", "Object"],
	["Furniture", "Furniture"],
	["Weapon", "MeleeWeapon"],
	["Hat", "Hat"],
	["Shirt", "Clothing"],
	["Pants", "Clothing"],
	["Boots", "Boots"],
	["Trinket", "Trinket"],
	["Mannequin", "Mannequin"],
]);

// Mapping of tool names to tool types
const toolTypeMap = new Map<string, ToolClass>([
	["Pail", "MilkPail"],
	["Pickaxe", "Pickaxe"],
	["Axe", "Axe"],
	["Hoe", "Hoe"],
	["Can", "WateringCan"],
	["Rod", "FishingRod"],
	["Pan", "Pan"],
	["Wand", "Wand"],
]);

const toolNameMap = new Map<string, string>([
	["Can", "Watering Can"],
	["Rod", "Fishing Rod"],
	["Pan", "Copper Pan"],
]);

// Mapping of level names to upgrade levels
const upgradeLevels = new Map([
	["Copper", 1],
	["Steel", 2],
	["Gold", 3],
	["Iridium", 4],
]);

const typeToCategoryMap = {
	Object: undefined,
	BigCraftable: ObjectCategory.BigCraftable,
	Boots: ObjectCategory.Boots,
	Pants: ObjectCategory.Clothing,
	Shirt: ObjectCategory.Clothing,
	Furniture: ObjectCategory.Furniture,
	Hat: ObjectCategory.Hat,
	Weapon: ObjectCategory.Weapon,
	Tool: ObjectCategory.Tool,
	Trinket: ObjectCategory.Trinket,
	Mannequin: ObjectCategory.Furniture,
};

/**
 * Represents an item in-game. Either in the player's inventory or placed in the world.
 */
export class Item implements DataProxy<ItemModel> {
	public [Raw]: ItemModel;

	readonly info?: ItemInformation;
	readonly sprite?: Sprite;

	// Todo use Symbol.dispose
	private _dispose?: () => void;

	// Reactive mutable fields

	/** The amount of this item the player has (1-999) */
	public amount: number | undefined;
	/** The quality level of this item (if applicable) (0, 1, 2, 4) */
	public quality: number | undefined;
	/** Edibility level of this item (if applicable) (-300, 0-999) */
	public edibility: number | undefined;
	/** Sale price of the item, before profession boosts(?) */
	public price: number | undefined;
	/** If the item is dyed or has variants, this will be the color */
	public color: Color | undefined;
	/** If the item is a weapon, this is the minimum random damage */
	public minDamage: number | undefined;
	/** If the item is a weapon, this is the maximum random damage */
	public maxDamage: number | undefined;
	/** If the item is a melee weapon, this is the swing speed. 0 is base, value can be positive or negative. */
	public speed: number | undefined;
	/** If the item is a melee weapon, this is the knockback. 1 is base. AKA "weight" */
	public knockback: number | undefined;
	/** If the item is a melee weapon, this is the critical hit chance. (e.g. 0.1 for 10%) */
	public critChance: number | undefined;
	/** If the item is a melee weapon, this is the damage multiplier for critical hits. (e.g. 2 for 200%) */
	public critMultiplier: number | undefined;
	/**
	 * I don't think precision does anything. According to Reddit, it's not implemented in-game.
	 * @deprecated doesn't do anything
	 */
	public precision: number | undefined;
	/** If the item is a weapon, this is the range at which effects & knockback apply. 0 is base. More info needed. */
	public areaOfEffect: number | undefined;
	/** Added defense stat, as shown in-game. Each point reduces damage taken by 1. */
	public defense: number | undefined;
	/** Added immunity stat, as shown in-game. From the Wiki: each point of immunity reduces the chance of being debuffed by 9.1% */
	public immunityBonus: number | undefined;
	/** For bottomless buckets */
	public isBottomless: boolean | undefined;
	/** For trinkets, random number from 0-9999998 */
	public generationSeed: number | undefined;

	constructor(raw: ItemModel) {
		this[Raw] = raw;
		// TODO shirt hack, need to fix
		const info =
			raw.name === "Shirt"
				? Shirts.get(raw.itemId.toString())
				: ItemData.get(ItemNameHelper(raw));
		// Missing metadata makes a handful of legacy or modded items fall back to raw values.
		if (!info) {
			console.warn(`Item "${raw.name}" not found in ItemData`);
			reportMissingItemMetadata(raw);
		}

		this.info = info;
		this.sprite = info ? new Sprite(info) : undefined;

		// Initialize reactive fields based on previous getter logic
		this.amount = $state(this.computeAmount());
		$effect(() => this.syncAmount());

		this.quality = $state(this.computeQuality());
		$effect(() => this.syncQuality());

		this.edibility = $state(this.computeEdibility());
		$effect(() => this.syncEdibility());

		this.price = $state(this.computePrice());
		$effect(() => this.syncPrice());

		this.color = $state(this.computeColor());
		$effect(() => this.syncColor());

		// Weapon / boots stats
		this.minDamage = $state(
			this.info?._type === "Weapon" ? this[Raw].minDamage : undefined,
		);
		$effect(() => this.syncMinDamage());

		this.maxDamage = $state(
			this.info?._type === "Weapon" ? this[Raw].maxDamage : undefined,
		);
		$effect(() => this.syncMaxDamage());

		this.speed = $state(
			this.info?._type === "Weapon" ? this[Raw].speed : undefined,
		);
		$effect(() => this.syncSpeed());

		this.knockback = $state(
			this.info?._type === "Weapon" ? this[Raw].knockback : undefined,
		);
		$effect(() => this.syncKnockback());

		this.critChance = $state(
			this.info?._type === "Weapon" ? this[Raw].critChance : undefined,
		);
		$effect(() => this.syncCritChance());

		this.critMultiplier = $state(
			this.info?._type === "Weapon" ? this[Raw].critMultiplier : undefined,
		);
		$effect(() => this.syncCritMultiplier());

		this.precision = $state(
			this.info?._type === "Weapon" ? this[Raw].addedPrecision : undefined,
		);
		$effect(() => this.syncPrecision());

		this.areaOfEffect = $state(
			this.info?._type === "Weapon" ? this[Raw].addedAreaOfEffect : undefined,
		);
		$effect(() => this.syncAreaOfEffect());

		this.defense = $state(
			this.info && ["Boots", "Weapon"].includes(this.info._type)
				? this[Raw].addedDefense
				: undefined,
		);
		$effect(() => this.syncDefense());

		this.immunityBonus = $state(
			this.info?._type === "Boots" ? this[Raw].immunityBonus : undefined,
		);
		$effect(() => this.syncImmunity());

		this.isBottomless = $state(
			this[Raw].name === "Watering Can" ? this[Raw].isBottomless : undefined,
		);
		$effect(() => this.syncBottomless());

		this.generationSeed = $state(
			this.info?._type === "Trinket" ? this[Raw].generationSeed : undefined,
		);
		$effect(() => this.syncGenerationSeed());
	}

	// Read-only derived properties retained as getters
	get name(): string {
		return ItemNameHelper(this[Raw]);
	}

	get id() {
		return this[Raw].itemId;
	}

	get type() {
		return this.info?._type;
	}

	get category() {
		return this[Raw].category;
	}

	/**
	 * Create a disposable instance of the item
	 *
	 * This is a convenience method for creating items that need to be constructed dynamically. It provides a
	 */
	static create(raw: ItemModel) {
		let instance!: Item;
		const dispose = $effect.root(() => {
			instance = new Item(raw);
		});
		instance._dispose = dispose;
		return instance;
	}

	static fromName(name: string) {
		let data = ItemData.get(name);
		if (!data) {
			data = Shirts.get(name);
		}

		if (!data) throw new Error(`Item "${name}" not found in ItemData`);

		// Determine the ObjectCategory
		// Lots of items are missing a ObjectCategory in the data, so we need to handle them separately
		const category =
			"category" in data ? data.category : typeToCategoryMap[data._type];

		// Initialize the item
		const item: ItemModel = {
			name: data.name,
			itemId: data._key,
			stack: 1,
			quality: 0,
			isRecipe: false,
			price: data.price ?? 0,
			parentSheetIndex: data.spriteIndex || undefined,
			indexInTileSheet: data.spriteIndex || undefined,
			category: category,
			hasBeenInInventory: true,
			SpecialVariable: 0, // TODO: Verify if needed
			isLostItem: false,
			specialItem: false,
			tileLocation: { X: 0, Y: 0 },
			boundingBox: {
				X: 0,
				Y: 0,
				Width: 64,
				Height: 64,
				Size: { X: 64, Y: 64 },
				Location: { X: 0, Y: 0 },
			},
			canBeSetDown: true,
			canBeGrabbed: true,
			// @ts-expect-error TODO fix later
			type:
				data._type === "Object"
					? data.type
					: data._type === "BigCraftable"
						? "Crafting"
						: undefined,
			bigCraftable: data._type === "BigCraftable" ? true : undefined,
		};

		// Set quality for items that can have quality
		if (category && CategoriesWithQuality.has(category)) {
			item.quality = 0;
		}

		// Determine the item type
		let itemType = typeToItemTypeMap.get(data._type);

		// Handle tools separately
		if (data._type === "Tool") {
			// Special handling for upgrade levels
			// Remove "Steel" from "Steel Watering Can" etc.
			const nameWithoutPrefix = name.split(" ").pop() ?? name;
			itemType = toolTypeMap.get(nameWithoutPrefix);
			if (
				itemType &&
				["Pickaxe", "Axe", "Hoe", "WateringCan"].includes(itemType)
			) {
				item.upgradeLevel = 0;
				for (const [levelName, levelValue] of upgradeLevels) {
					if (name.startsWith(levelName)) {
						item.upgradeLevel = levelValue;

						// Remove "Steel" from "Steel Watering Can" etc.
						item.name = toolNameMap.get(nameWithoutPrefix) ?? nameWithoutPrefix;
						break;
					}
				}
				item.indexOfMenuItemView = data.menuSpriteIndex;
			}

			if (itemType === "FishingRod") {
				item.upgradeLevel = FishingRodUpgradeNumber.get(data.name) ?? 0;
				item.parentSheetIndex = 685;
				item.initialParentTileIndex = FishingRodSpriteIndex.get(data.name) ?? 0;
				item.indexOfMenuItemView = item.initialParentTileIndex;
			}

			if (itemType === "WateringCan") {
				item.IsBottomless = false;
				item.isBottomless = false;
			}

			// Other tools (Wand) don't match the above behavior
			// For now, I'll just add this catch all
			if (!itemType) itemType = toolTypeMap.get(data.class);
		}

		// Handle weapon properties
		if (data._type === "Weapon") {
			item.minDamage = data.minDamage;
			item.maxDamage = data.maxDamage;
			item.speed = data.speed;
			item.addedPrecision = data.precision;
			item.addedDefense = data.defense;
			item.addedAreaOfEffect = data.areaOfEffect;
			item.knockback = data.knockback;
			item.critChance = data.critChance;
			item.critMultiplier = data.critMultiplier;
		}

		// Handle trinket properties
		if (data._type === "Trinket") {
			item.generationSeed = Math.floor(Math.random() * 9999999); // Random seed between 0 and 9999998
		}

		// Set the xsi:type if itemType is determined
		if (itemType) {
			// This is required for the game to recognize the item as the correct type, but isn't part of the XML structures
			// @ts-expect-error
			item["@_xsi:type"] = itemType;
		}

		// Set ID for rings
		if (data._type === "Object" && data.type === TypeEnum.Ring) {
			item.uniqueID = RingsUniqueID.get(name);
			console.log(item.uniqueID);
			// @ts-expect-error
			item["@_xsi:type"] = "Ring";
		}

		// Handle hats
		if (data._type === "Hat") {
			// @ts-expect-error
			item.which = nil;
			item.skipHairDraw = data.showRealHair;
			item.ignoreHairstyleOffset = data.skipHairstyleOffset;
		}

		// Handle furniture
		if (data._type === "Furniture") {
			item.canBeGrabbed = true;
			item.type = FurnitureTypeToNumber.get(data.type as FurnitureType);

			// Set sourceRect if TilesheetSize is available
			const sprite = new Sprite(data);
			if ("tilesheetSize" in data && data.tilesheetSize !== undefined) {
				const invertedX = sprite.sheetSize.width - sprite.dimensions.x;
				const invertedY = sprite.sheetSize.height - sprite.dimensions.y;
				item.sourceRect = {
					X: invertedX,
					Y: invertedY,
					Width: data.tilesheetSize.width * 16,
					Height: data.tilesheetSize.height * 16,
					Location: {
						X: invertedX,
						Y: invertedY,
					},
					Size: {
						X: data.tilesheetSize.width * 16,
						Y: data.tilesheetSize.height * 16,
					},
				};
				item.defaultSourceRect = item.sourceRect;
			}

			// Set boundingBox if BoundingBoxSize is available
			if ("boundingBoxSize" in data && data.boundingBoxSize !== undefined) {
				item.boundingBox = {
					X: 0,
					Y: 0,
					Width: data.boundingBoxSize.width,
					Height: data.boundingBoxSize.height,
					Size: {
						X: data.boundingBoxSize.width,
						Y: data.boundingBoxSize.height,
					},
					Location: {
						X: 0,
						Y: 0,
					},
				};
				item.defaultBoundingBox = item.boundingBox;
			}

			// Enable lamp property for lamp-type furniture
			if (data.type === FurnitureType.Lamp) {
				item.isLamp = true;
			}
		}

		// Handle dyeable items
		if ("canBeDyed" in data && data.canBeDyed) {
			const defaultColor = new Color("#FFFFFF");
			// if (data.defaultColor) {
			//     console.log(data.defaultColor);
			//     const [R, G, B] = data.defaultColor.split(" ").map(Number);
			//     if (!R || !G || !B)
			//         throw new Error(`Invalid color for item "${name}"`);
			//     defaultColor = new Color({ R, G, B });
			// }
			// item.clothesColor = defaultColor;
			// Default color is actually just RED for some reason

			item.clothesColor = defaultColor;
		}

		// Set edibility and price if available
		if ("edibility" in data) {
			item.edibility = data.edibility;
		}
		item.price = data.price ?? 0;

		// Handle clothes types
		if (data._type in ClothesType) {
			item.clothesType = ClothesType[data._type as keyof typeof ClothesType];
		}
		if (data._type === "Boots") {
			item.indexInColorSheet = data.colorIndex;
		}

		// Handle preserved items
		if (
			"unpreservedItemId" in data &&
			data.unpreservedItemId &&
			data.preservedItemName
		) {
			item.preservedParentSheetIndex = Number.parseInt(data.unpreservedItemId);

			item.preserve = data.preservedItemName;
		}

		// Handle colored items (e.g. Wines, Juices)
		if (data.color) {
			item.color = new Color(data.color);

			if (data._type === "Object") {
				// @ts-expect-error
				item["@_xsi:type"] = "ColoredObject";
			}
		}

		// TODO: Handle the Copper Pan hat special case if needed

		const newItem = Item.create(item);

		return newItem;
	}

	static fromKey(key: string, type: string) {
		console.log(key, type, KeyToName(key, type));
		const name = KeyToName(key, type);

		return Item.fromName(name);
	}

	// --- Validation & sync helpers ---
	private computeAmount() {
		if (!this.info) return undefined;
		if (
			["Clothing", "Boots", "Hat", "Weapon", "Pants", "Shirt", "Tool"].includes(
				this.info._type,
			)
		)
			return undefined;
		return this[Raw].stack ?? 1;
	}

	private syncAmount() {
		// Re-check applicability (user might have forced a value onto a non-stackable item)
		if (!this.info) return;
		const applicable = ![
			"Clothing",
			"Boots",
			"Hat",
			"Weapon",
			"Pants",
			"Shirt",
			"Tool",
		].includes(this.info._type);
		if (!applicable) {
			if (this.amount !== undefined) {
				console.warn("Amount not applicable to this item type; resetting.");
			}
			this.amount = undefined;
			return;
		}
		if (this.amount === undefined) return;
		if (this.amount < 1) this.amount = 1;
		this[Raw].stack = this.amount;
	}

	private computeQuality() {
		if (!this[Raw].category) return undefined;
		if (!CategoriesWithQuality.has(this[Raw].category)) return undefined;
		return this[Raw].quality;
	}

	private syncQuality() {
		if (this.quality === undefined) return;
		if (this.quality < 0) this.quality = 0;
		if (this.quality === 3) this.quality = 2;
		if (this.quality > 4) this.quality = 4;
		this[Raw].quality = this.quality;
	}

	private computeEdibility() {
		if (!("edibility" in this[Raw]) || this[Raw].edibility === -300)
			return undefined;
		return this[Raw].edibility;
	}

	private syncEdibility() {
		if (this.edibility === undefined) return;
		this[Raw].edibility = this.edibility;
	}

	private computePrice() {
		if (
			!this.info ||
			!["Object", "BigCraftable", "Furniture", "Hat", "Clothing"].includes(
				this.info._type,
			)
		)
			return undefined;
		return this[Raw].price;
	}

	private syncPrice() {
		if (this.price === undefined) return;
		if (this.price < 0) this.price = 0;
		if (this.price > 99999) this.price = 99999;
		this[Raw].price = this.price;
	}

	private computeColor() {
		if (
			!this.info ||
			!("canBeDyed" in this.info) ||
			!this.info.canBeDyed ||
			!this[Raw].clothesColor
		)
			return undefined;
		return new Color(this[Raw].clothesColor);
	}

	private syncColor() {
		if (!this.color) return;
		this[Raw].clothesColor = this.color;
	}

	private syncMinDamage() {
		if (this.minDamage === undefined) return;
		if (this.minDamage < 0) this.minDamage = 0;
		if (this.minDamage > 999) this.minDamage = 999;
		this[Raw].minDamage = this.minDamage;
	}

	private syncMaxDamage() {
		if (this.maxDamage === undefined) return;
		if (this.maxDamage < 0) this.maxDamage = 0;
		if (this.maxDamage > 999) this.maxDamage = 999;
		this[Raw].maxDamage = this.maxDamage;
	}

	private syncSpeed() {
		if (this.speed === undefined) return;
		if (this.speed < 0) this.speed = 0;
		if (this.speed > 999) this.speed = 999;
		this[Raw].speed = this.speed;
	}

	private syncKnockback() {
		if (this.knockback === undefined) return;
		if (this.knockback < 0) this.knockback = 0;
		if (this.knockback > 999) this.knockback = 999;
		this[Raw].knockback = this.knockback;
	}

	private syncCritChance() {
		if (this.critChance === undefined) return;
		if (this.critChance < 0) this.critChance = 0;
		if (this.critChance > 1) this.critChance = 1;
		this[Raw].critChance = this.critChance;
	}

	private syncCritMultiplier() {
		if (this.critMultiplier === undefined) return;
		if (this.critMultiplier < 0) this.critMultiplier = 0;
		this[Raw].critMultiplier = this.critMultiplier;
	}

	private syncPrecision() {
		if (this.precision === undefined) return;
		if (this.precision < 0) this.precision = 0;
		if (this.precision > 999) this.precision = 999;
		this[Raw].addedPrecision = this.precision;
	}

	private syncAreaOfEffect() {
		if (this.areaOfEffect === undefined) return;
		if (this.areaOfEffect < 0) this.areaOfEffect = 0;
		if (this.areaOfEffect > 999) this.areaOfEffect = 999;
		this[Raw].addedAreaOfEffect = this.areaOfEffect;
	}

	private syncDefense() {
		if (this.defense === undefined) return;
		if (this.defense < 0) this.defense = 0;
		if (this.defense > 999) this.defense = 999;
		this[Raw].addedDefense = this.defense;
	}

	private syncImmunity() {
		if (this.immunityBonus === undefined) return;
		if (this.immunityBonus < 0) this.immunityBonus = 0;
		this[Raw].immunityBonus = this.immunityBonus;
	}

	private syncBottomless() {
		if (this.isBottomless === undefined) return;
		this[Raw].isBottomless = this.isBottomless;
		this[Raw].IsBottomless = this.isBottomless;
	}

	private syncGenerationSeed() {
		if (this.generationSeed === undefined) return;
		this[Raw].generationSeed = this.generationSeed;
	}

	public dispose() {
		try {
			this._dispose?.();
		} finally {
			this._dispose = undefined;
		}
	}
}

const reportedMissingItemMetadata = new Set<string>();

function reportMissingItemMetadata(raw: ItemModel) {
	const key = `${raw.itemId ?? "unknown"}:${raw.name ?? ""}`;
	// Avoid reporting the same item metadata gap repeatedly; inventory rehydration can instantiate
	// the same raw item many times during a session.
	if (reportedMissingItemMetadata.has(key)) return;
	reportedMissingItemMetadata.add(key);

	if (typeof window === "undefined") return;

	Sentry.logger.error("Item metadata missing from ItemData lookup", {
		itemId: raw.itemId ?? null,
		name: raw.name ?? null,
		type: raw.type ?? null,
	});
}

/**
 * Check if an item is valid for a given equipment slot
 *
 * If we put boots in the hat slot, the game crashes. This check needs to be ran in UI rather than in the Item class itself, because the Item class doesn't know what slot it's being placed into.
 */
export const ValidSlotForItem = (item: Item, slot: ParentIndex) => {
	if (typeof slot === "number") return true;

	const allowedTypes = {
		leftRing: "Ring",
		rightRing: "Ring",
		boots: "Boots",
		hat: "Hat",
		shirtItem: "Clothing",
		pantsItem: "Clothing",
		trinketItem: "Trinket",
	} satisfies Record<Exclude<ParentIndex, number>, string>;

	return allowedTypes[slot] === item.info?._type;
};
