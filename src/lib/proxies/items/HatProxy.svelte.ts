import type { ParentIndex } from "$lib/ItemParentIndex";
import type { Hat as HatInfo } from "$types/items";
import type { HatItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

const HAT_SLOT: ParentIndex = "hat";

export class HatProxy extends BaseItemProxy<HatItem> {
	readonly hatInfo: HatInfo;

	public skipHairDraw: boolean | undefined;
	public ignoreHairstyleOffset: boolean | undefined;
	public hairDrawType: number | undefined;
	public isPrismatic: boolean | undefined;

	constructor(raw: HatItem) {
		super(raw);
		this.ensureHat();
		this.hatInfo = this.info as HatInfo;

		this.skipHairDraw = $state(this[Raw].skipHairDraw);
		$effect(() => {
			this[Raw].skipHairDraw = this.skipHairDraw;
		});

		this.ignoreHairstyleOffset = $state(this[Raw].ignoreHairstyleOffset);
		$effect(() => {
			this[Raw].ignoreHairstyleOffset = this.ignoreHairstyleOffset;
		});

		this.hairDrawType = $state(this[Raw].hairDrawType);
		$effect(() => {
			this[Raw].hairDrawType = this.hairDrawType;
		});

		this.isPrismatic = $state(this[Raw].isPrismatic);
		$effect(() => {
			this[Raw].isPrismatic = this.isPrismatic;
		});
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

	private ensureHat(): asserts this is HatProxy {
		if (this.info?._type !== "Hat") {
			throw new TypeError(`Item "${this.name}" is not a Hat`);
		}
	}
}
