import type { ParentIndex } from "$lib/ItemParentIndex";
import type { Boots as BootsInfo } from "$types/items";
import type { BootsItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

const BOOTS_SLOT = "boots";

export class BootsProxy extends BaseItemProxy<BootsItem> {
	readonly bootsInfo: BootsInfo;

	public defenseBonus: number | undefined;
	public immunityBonus: number | undefined;
	public indexInTileSheet: number | undefined;
	public price: number | undefined;
	public indexInColorSheet: number | undefined;
	public appliedBootSheetIndex: string | undefined;

	constructor(raw: BootsItem) {
		super(raw);
		this.ensureBoots();
		this.bootsInfo = this.info as BootsInfo;

		this.defenseBonus = $state(this[Raw].defenseBonus);
		$effect(() => {
			this[Raw].defenseBonus = this.defenseBonus;
		});

		this.immunityBonus = $state(this[Raw].immunityBonus);
		$effect(() => {
			this[Raw].immunityBonus = this.immunityBonus;
		});

		this.indexInTileSheet = $state(this[Raw].indexInTileSheet);
		$effect(() => {
			this[Raw].indexInTileSheet = this.indexInTileSheet;
		});

		this.price = $state(this[Raw].price);
		$effect(() => {
			this[Raw].price = this.price;
		});

		this.indexInColorSheet = $state(this[Raw].indexInColorSheet);
		$effect(() => {
			this[Raw].indexInColorSheet = this.indexInColorSheet;
		});

		this.appliedBootSheetIndex = $state(this[Raw].appliedBootSheetIndex);
		$effect(() => {
			this[Raw].appliedBootSheetIndex = this.appliedBootSheetIndex;
		});
	}

	get slotName(): ParentIndex {
		return BOOTS_SLOT;
	}

	static isSlotCompatible(slot: ParentIndex) {
		return slot === BOOTS_SLOT;
	}

	private ensureBoots(): asserts this is BootsProxy {
		if (this.info?._type !== "Boots") {
			throw new TypeError(`Item "${this.name}" is not Boots`);
		}
	}
}
