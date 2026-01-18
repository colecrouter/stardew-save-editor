import type { ParentIndex } from "$lib/ItemParentIndex";
import type { Trinket as TrinketInfo } from "$types/items";
import type { TrinketItem } from "$types/save";
import { ItemProxy, Raw } from "./ItemProxy";

const TRINKET_SLOT: ParentIndex = "trinketItem";

export class TrinketProxy extends ItemProxy<TrinketItem> {
	readonly trinketInfo: TrinketInfo;

	constructor(raw: TrinketItem) {
		super(raw);
		this.trinketInfo = this.ensureTrinket();
	}

	static isSlotCompatible(slot: ParentIndex) {
		return slot === TRINKET_SLOT;
	}

	get displayNameOverrideTemplate(): unknown {
		return this[Raw].displayNameOverrideTemplate;
	}

	set displayNameOverrideTemplate(value: unknown) {
		this[Raw].displayNameOverrideTemplate = value;
	}

	get descriptionSubstitutionTemplates() {
		return this[Raw].descriptionSubstitutionTemplates;
	}

	set descriptionSubstitutionTemplates(value: unknown) {
		this[Raw].descriptionSubstitutionTemplates = value;
	}

	get computedGenerationSeed(): number {
		this.ensureTrinket();
		return this[Raw].generationSeed ?? 0;
	}

	private ensureTrinket(): TrinketInfo {
		if (this.info?._type !== "Trinket") {
			throw new TypeError(`Item "${this.name}" is not a Trinket`);
		}
		return this.info;
	}
}
