import type { Item as ItemModel } from "$types/save";
import { TypeEnum } from "$types/save";
import { BootsProxy } from "./BootsProxy";
import { ClothingProxy } from "./ClothingProxy";
import { ColoredObjectProxy } from "./ColoredObjectProxy";
import { HatProxy } from "./HatProxy";
import { ItemProxy, resolveItemInformation } from "./ItemProxy";
import { RingProxy } from "./RingProxy";
import { ToolProxy } from "./ToolProxy";
import { TrinketProxy } from "./TrinketProxy";
import type {
	BootsItemModel,
	ClothingItemModel,
	ColoredObjectItemModel,
	HatItemModel,
	ItemModelBase,
	RingItemModel,
	ToolItemModel,
	TrinketItemModel,
	WeaponItemModel,
} from "./types";
import { hasRawType, hasTypeEnum, hasXsiType } from "./types";
import { WeaponProxy } from "./WeaponProxy";

export function createItemProxy(raw: ItemModel) {
	const base = raw as ItemModelBase;
	const info = resolveItemInformation(base);
	const type = info?._type;
	if (type === "Weapon" && hasRawType(base, "Weapon")) {
		return new WeaponProxy(base as WeaponItemModel);
	}
	if (type === "Tool" && hasRawType(base, "Tool")) {
		return new ToolProxy(base as ToolItemModel);
	}
	if (type === "Trinket" && hasRawType(base, "Trinket")) {
		return new TrinketProxy(base as TrinketItemModel);
	}
	if (type === "Hat" && hasRawType(base, "Hat")) {
		return new HatProxy(base as HatItemModel);
	}
	if (type === "Boots" && hasRawType(base, "Boots")) {
		return new BootsProxy(base as BootsItemModel);
	}
	if ((type === "Shirt" || type === "Pants") && hasRawType(base, type)) {
		return new ClothingProxy(base as ClothingItemModel);
	}

	const isRing =
		type === "Object" &&
		hasRawType(base, "Object") &&
		hasXsiType(base, "Ring") &&
		hasTypeEnum(TypeEnum.Ring)(base);
	if (isRing) {
		return new RingProxy(base as RingItemModel);
	}

	const isColoredObject =
		type === "Object" &&
		hasRawType(base, "Object") &&
		hasXsiType(base, "ColoredObject");
	if (isColoredObject) {
		return new ColoredObjectProxy(base as ColoredObjectItemModel);
	}

	return new ItemProxy(base);
}
