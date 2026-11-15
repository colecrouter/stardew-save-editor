import type { ParentIndex } from "$lib/ItemParentIndex";
import { Color } from "$lib/proxies/Color.svelte";
import type { ClothesType, ClothingItem } from "$types/save";

import { writeOptionalField } from "../../optional-field.ts";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

const CLOTHING_SLOTS: ReadonlySet<ParentIndex> = new Set<ParentIndex>([
	"shirtItem",
	"pantsItem",
]);

export class ClothingProxy extends BaseItemProxy<ClothingItem> {
	public indexInTileSheet: number | undefined;
	public dyeable: boolean | undefined;
	public isPrismatic: boolean | undefined;
	public color: Color | undefined;

	constructor(raw: ClothingItem) {
		super(raw);
		this.ensureClothing();

		this.indexInTileSheet = $state(this[Raw].indexInTileSheet);
		$effect(() => {
			writeOptionalField(this[Raw], "indexInTileSheet", this.indexInTileSheet);
		});

		this.dyeable = $state(this[Raw].dyeable);
		$effect(() => {
			writeOptionalField(this[Raw], "dyeable", this.dyeable);
		});

		this.isPrismatic = $state(this[Raw].isPrismatic);
		$effect(() => {
			writeOptionalField(this[Raw], "isPrismatic", this.isPrismatic);
		});

		this.color = $state(this.computeClothesColor());
		$effect(() => this.syncClothesColor());
	}

	static isClothingSlot(slot: ParentIndex) {
		return CLOTHING_SLOTS.has(slot);
	}

	static isSlotCompatible(slot: ParentIndex) {
		return ClothingProxy.isClothingSlot(slot);
	}

	get clothesType(): ClothesType | undefined {
		return this[Raw].clothesType;
	}

	set clothesType(value: ClothesType | undefined) {
		writeOptionalField(this[Raw], "clothesType", value);
	}

	private computeClothesColor() {
		return this[Raw].clothesColor
			? new Color(this[Raw].clothesColor)
			: undefined;
	}

	private syncClothesColor() {
		if (!this.color) return;
		this[Raw].clothesColor = this.color;
	}

	private ensureClothing(): asserts this is ClothingProxy {
		if (!this.info) {
			throw new TypeError(`Item "${this.name}" is not clothing`);
		}
		if (!(this.info._type === "Shirt" || this.info._type === "Pants")) {
			throw new TypeError(`Item "${this.name}" is not clothing`);
		}
	}
}
