import type { ParentIndex } from "$lib/ItemParentIndex";
import { type RingItem, TypeEnum } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

const RING_SLOTS: ParentIndex[] = ["leftRing", "rightRing"];

export class RingProxy extends BaseItemProxy<RingItem> {
	public uniqueID: number | undefined;

	constructor(raw: RingItem) {
		super(raw);
		this.ensureRing();

		this.uniqueID = $state(this[Raw].uniqueID);
		$effect(() => {
			this[Raw].uniqueID = this.uniqueID;
		});
	}

	static isSlotCompatible(slot: ParentIndex) {
		return RING_SLOTS.includes(slot);
	}

	private ensureRing(): asserts this is RingProxy {
		if (this.info?._type !== "Object" || this.info.type !== TypeEnum.Ring) {
			throw new TypeError(`Item "${this.name}" is not a Ring`);
		}
	}
}
