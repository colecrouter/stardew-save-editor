import type { ParentIndex } from "$lib/ItemParentIndex";
import { TypeEnum } from "$types/save";
import { ItemProxy, Raw } from "./ItemProxy";
import type { RingItemModel } from "./types";

const RING_SLOTS: ParentIndex[] = ["leftRing", "rightRing"];

export class RingProxy extends ItemProxy {
	constructor(raw: RingItemModel) {
		super(raw);
		this.ensureRing();
	}

	static isSlotCompatible(slot: ParentIndex) {
		return RING_SLOTS.includes(slot);
	}

	get uniqueID(): number | undefined {
		return this[Raw].uniqueID;
	}

	set uniqueID(value: number | undefined) {
		this[Raw].uniqueID = value;
	}

	private ensureRing(): asserts this is RingProxy {
		if (this.info?._type !== "Object" || this.info.type !== TypeEnum.Ring) {
			throw new TypeError(`Item "${this.name}" is not a Ring`);
		}
	}
}
