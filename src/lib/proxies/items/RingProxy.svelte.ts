import type { ParentIndex } from "$lib/ItemParentIndex";
import { type CombinedRingItem, type RingItem, TypeEnum } from "$types/save";

import { writeOptionalField } from "../../optional-field.ts";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

const RING_SLOTS: ReadonlySet<ParentIndex> = new Set<ParentIndex>([
	"leftRing",
	"rightRing",
]);

export class RingProxy extends BaseItemProxy<RingItem | CombinedRingItem> {
	public uniqueID: number | undefined;

	constructor(raw: RingItem | CombinedRingItem) {
		super(raw);
		this.ensureRing();

		this.uniqueID = $state(this[Raw].uniqueID);
		$effect(() => {
			writeOptionalField(this[Raw], "uniqueID", this.uniqueID);
		});
	}

	static isSlotCompatible(slot: ParentIndex) {
		return RING_SLOTS.has(slot);
	}

	private ensureRing(): asserts this is RingProxy {
		// Ordinary and combined rings share this catalog check; component records
		// stay in the raw saved representation.
		if (this.info?._type !== "Object" || this.info.type !== TypeEnum.Ring) {
			throw new TypeError(`Item "${this.name}" is not a Ring`);
		}
	}
}
