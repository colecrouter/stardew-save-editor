import type { ParentIndex } from "$lib/ItemParentIndex";
import type { Hat as HatInfo } from "$types/items";
import type { HatItem } from "$types/save";
import { ItemProxy, Raw } from "./ItemProxy";

const HAT_SLOT: ParentIndex = "hat";

export class HatProxy extends ItemProxy<HatItem> {
	readonly hatInfo: HatInfo;

	constructor(raw: HatItem) {
		super(raw);
		this.hatInfo = this.ensureHat();
	}

	get slotName(): ParentIndex {
		return HAT_SLOT;
	}

	static isHat(slot: ParentIndex) {
		return slot === HAT_SLOT;
	}

	static isSlotCompatible(slot: ParentIndex) {
		return HatProxy.isHat(slot);
	}

	get skipHairDraw(): boolean | undefined {
		return this[Raw].skipHairDraw;
	}

	set skipHairDraw(value: boolean | undefined) {
		this[Raw].skipHairDraw = value;
	}

	get ignoreHairstyleOffset(): boolean | undefined {
		return this[Raw].ignoreHairstyleOffset;
	}

	private ensureHat(): HatInfo {
		if (this.info?._type !== "Hat") {
			throw new TypeError(`Item "${this.name}" is not a Hat`);
		}
		return this.info;
	}
}
