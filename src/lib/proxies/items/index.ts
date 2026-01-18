import type {
	BootsItem,
	ClothingItem,
	ColoredObjectItem,
	HatItem,
	Item,
	RingItem,
	ToolItem,
	TrinketItem,
	WeaponItem,
} from "$types/save";
import { BootsProxy } from "./BootsProxy";
import { ClothingProxy } from "./ClothingProxy";
import { ColoredObjectProxy } from "./ColoredObjectProxy";
import { HatProxy } from "./HatProxy";
import { ItemProxy } from "./ItemProxy";
import { RingProxy } from "./RingProxy";
import { ToolProxy } from "./ToolProxy";
import { TrinketProxy } from "./TrinketProxy";
import { WeaponProxy } from "./WeaponProxy";

export function createItemProxy(raw: Item) {
	const base = raw as Item;
	const rawType = base["@_xsi:type"];
	if (rawType === "MeleeWeapon") {
		return new WeaponProxy(base as WeaponItem);
	}
	if (rawType === "Tool") {
		return new ToolProxy(base as ToolItem);
	}
	if (rawType === "Trinket") {
		return new TrinketProxy(base as TrinketItem);
	}
	if (rawType === "Hat") {
		return new HatProxy(base as HatItem);
	}
	if (rawType === "Boots") {
		return new BootsProxy(base as BootsItem);
	}
	if (rawType === "Clothing") {
		return new ClothingProxy(base as ClothingItem);
	}
	if (rawType === "Ring") {
		return new RingProxy(base as RingItem);
	}
	if (rawType === "ColoredObject") {
		return new ColoredObjectProxy(base as ColoredObjectItem);
	}

	return new ItemProxy(base);
}
