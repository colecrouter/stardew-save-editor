import type { ParentIndex } from "$lib/ItemParentIndex";
import type { Trinket as TrinketInfo } from "$types/items";
import { ItemProxy, Raw } from "./ItemProxy";
import type { TrinketItemModel } from "./types";

const TRINKET_SLOT: ParentIndex = "trinketItem";

export class TrinketProxy extends ItemProxy {
	readonly trinketInfo: TrinketInfo;

	constructor(raw: TrinketItemModel) {
		super(raw);
		this.trinketInfo = this.ensureTrinket();
	}

	static isSlotCompatible(slot: ParentIndex) {
		return slot === TRINKET_SLOT;
	}

	get displayNameOverrideTemplate(): string | undefined {
		return this.trinketRaw.displayNameOverrideTemplate;
	}

	set displayNameOverrideTemplate(value: string | undefined) {
		this.trinketRaw.displayNameOverrideTemplate = value;
	}

	get descriptionSubstitutionTemplates(): string[] {
		return this.trinketRaw.descriptionSubstitutionTemplates ?? [];
	}

	set descriptionSubstitutionTemplates(value: string[] | undefined) {
		this.trinketRaw.descriptionSubstitutionTemplates = value;
	}

	get trinketMetadata(): Record<string, string> {
		return this.trinketRaw.trinketMetadata ?? {};
	}

	setTrinketMetadata(key: string, value: string | undefined) {
		if (!this.trinketRaw.trinketMetadata) {
			this.trinketRaw.trinketMetadata = {};
		}
		if (value == null) {
			delete this.trinketRaw.trinketMetadata[key];
			return;
		}
		this.trinketRaw.trinketMetadata[key] = value;
	}

	get displayNameFormat(): string | undefined {
		return this.trinketRaw.displayNameFormat;
	}

	set displayNameFormat(value: string | undefined) {
		this.trinketRaw.displayNameFormat = value;
	}

	private get trinketRaw() {
		return this[Raw] as TrinketItemModel;
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
