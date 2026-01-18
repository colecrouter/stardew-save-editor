import type { ParentIndex } from "$lib/ItemParentIndex";
import { Color } from "$lib/proxies/Color.svelte";
import type { ClothesType, ClothingItem } from "$types/save";
import { ItemProxy, Raw } from "./ItemProxy";

const CLOTHING_SLOTS: ParentIndex[] = ["shirtItem", "pantsItem"];

export class ClothingProxy extends ItemProxy<ClothingItem> {
	constructor(raw: ClothingItem) {
		super(raw);
		this.ensureClothing();
	}

	static isClothingSlot(slot: ParentIndex) {
		return CLOTHING_SLOTS.includes(slot);
	}

	static isSlotCompatible(slot: ParentIndex) {
		return ClothingProxy.isClothingSlot(slot);
	}

	get clothesType(): ClothesType | undefined {
		return this[Raw].clothesType;
	}

	set clothesType(value: ClothesType | undefined) {
		this[Raw].clothesType = value;
	}

	get clothesColor(): Color | undefined {
		return (
			this.color ??
			(this[Raw].clothesColor ? new Color(this[Raw].clothesColor) : undefined)
		);
	}

	set clothesColor(value: Color | undefined) {
		if (!value) return;
		this.color = value;
		this[Raw].clothesColor = value;
	}

	private ensureClothing() {
		if (!this.info) {
			throw new TypeError(`Item "${this.name}" is not clothing`);
		}
		if (!(this.info._type === "Shirt" || this.info._type === "Pants")) {
			throw new TypeError(`Item "${this.name}" is not clothing`);
		}
	}
}
