import type {
	BootsItem,
	CaskItem,
	ClothingItem,
	ColoredObjectItem,
	FurnitureItem,
	HatItem,
	Item,
	KnownItemTypes,
	ObjectItem,
	RingItem,
	ToolItem,
	TrinketItem,
	WeaponItem,
} from "$types/save";

import { AxeProxy } from "./AxeProxy.svelte";
import { BootsProxy } from "./BootsProxy.svelte";
import { CaskProxy } from "./CaskProxy.svelte";
import { ClothingProxy } from "./ClothingProxy.svelte";
import { ColoredObjectProxy } from "./ColoredObjectProxy.svelte";
import { FishingRodProxy } from "./FishingRodProxy.svelte";
import { FurnitureProxy } from "./FurnitureProxy.svelte";
import { HatProxy } from "./HatProxy.svelte";
import { BaseItemProxy } from "./ItemProxy.svelte";
import { ObjectProxy } from "./ObjectProxy.svelte";
import { PanProxy } from "./PanProxy.svelte";
import { PickaxeProxy } from "./PickaxeProxy.svelte";
import { RingProxy } from "./RingProxy.svelte";
import { SlingshotProxy } from "./SlingshotProxy.svelte";
import { ToolProxy } from "./ToolProxy.svelte";
import { TrinketProxy } from "./TrinketProxy.svelte";
import { WateringCanProxy } from "./WateringCanProxy.svelte";
import { WeaponProxy } from "./WeaponProxy.svelte";

export type ItemProxy =
	| WeaponProxy
	| ToolProxy
	| FishingRodProxy
	| WateringCanProxy
	| SlingshotProxy
	| PickaxeProxy
	| AxeProxy
	| PanProxy
	| TrinketProxy
	| HatProxy
	| BootsProxy
	| ClothingProxy
	| RingProxy
	| ColoredObjectProxy
	| FurnitureProxy
	| CaskProxy
	| ObjectProxy
	| BaseItemProxy;

/**
 * Factory function to create the appropriate ItemProxy subclass based on the raw item's type.
 * If the type is unknown, it falls back to a generic ItemProxy and logs a warning.
 */
export function createItemProxy(base: Item): ItemProxy {
	switch (base["@_xsi:type"] as KnownItemTypes) {
		case "MeleeWeapon":
			return new WeaponProxy(base as WeaponItem);
		case "Tool":
			return new ToolProxy(base as ToolItem);
		case "Trinket":
			return new TrinketProxy(base as TrinketItem);
		case "Hat":
			return new HatProxy(base as HatItem);
		case "Boots":
			return new BootsProxy(base as BootsItem);
		case "Clothing":
			return new ClothingProxy(base as ClothingItem);
		case "Ring":
			return new RingProxy(base as RingItem);
		case "ColoredObject":
			return new ColoredObjectProxy(base as ColoredObjectItem);
		case "Furniture":
			return new FurnitureProxy(base as FurnitureItem);
		case "Object":
			return new ObjectProxy(base as ObjectItem);
		case "Axe":
			return new AxeProxy(base as ToolItem);
		case "Pickaxe":
			return new PickaxeProxy(base as ToolItem);
		case "Slingshot":
			return new SlingshotProxy(base as ToolItem);
		case "WateringCan":
			return new WateringCanProxy(base as ToolItem);
		case "Pan":
			return new PanProxy(base as ToolItem);
		case "Cask":
			return new CaskProxy(base as CaskItem);
		case undefined:
			return new BaseItemProxy(base);
		default:
			console.warn(
				`Unknown item type: ${base["@_xsi:type"]}. Falling back to generic ItemProxy.`,
			);
			return new BaseItemProxy(base);
	}
}

export {
	AxeProxy,
	BaseItemProxy,
	BootsProxy,
	CaskProxy,
	ClothingProxy,
	ColoredObjectProxy,
	FishingRodProxy,
	FurnitureProxy,
	HatProxy,
	ObjectProxy,
	PanProxy,
	PickaxeProxy,
	RingProxy,
	SlingshotProxy,
	ToolProxy,
	TrinketProxy,
	WateringCanProxy,
	WeaponProxy,
};
