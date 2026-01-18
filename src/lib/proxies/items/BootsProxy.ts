import type { ParentIndex } from "$lib/ItemParentIndex";
import type { Boots as BootsInfo } from "$types/items";
import { ItemProxy, Raw } from "./ItemProxy";
import type { BootsItemModel } from "./types";

const BOOTS_SLOT = "boots";

export class BootsProxy extends ItemProxy {
	readonly bootsInfo: BootsInfo;

	constructor(raw: BootsItemModel) {
		super(raw);
		this.bootsInfo = this.ensureBoots();
	}

	get slotName(): ParentIndex {
		return BOOTS_SLOT;
	}

	static isSlotCompatible(slot: ParentIndex) {
		return slot === BOOTS_SLOT;
	}

	applyDefenseBonus(value: number | undefined) {
		this[Raw].addedDefense = value;
	}

	applyImmunityBonus(value: number | undefined) {
		this[Raw].immunityBonus = value;
	}

	setPaletteIndex(value: number | undefined) {
		this[Raw].indexInColorSheet = value;
	}

	private ensureBoots(): BootsInfo {
		if (this.info?._type !== "Boots") {
			throw new TypeError(`Item "${this.name}" is not Boots`);
		}
		return this.info;
	}
}
