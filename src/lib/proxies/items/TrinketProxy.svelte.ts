import type { ParentIndex } from "$lib/ItemParentIndex";
import type { Trinket as TrinketInfo } from "$types/items";
import type { TrinketItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

const TRINKET_SLOT: ParentIndex = "trinketItem";

export class TrinketProxy extends BaseItemProxy<TrinketItem> {
	readonly trinketInfo: TrinketInfo;

	public displayNameOverrideTemplate: unknown;
	public descriptionSubstitutionTemplates: unknown;
	public generationSeed: number | undefined;
	public trinketMetadata: unknown;

	constructor(raw: TrinketItem) {
		super(raw);
		this.ensureTrinket();
		this.trinketInfo = this.info as TrinketInfo;

		this.displayNameOverrideTemplate = $state(
			this[Raw].displayNameOverrideTemplate,
		);
		$effect(() => {
			this[Raw].displayNameOverrideTemplate = this.displayNameOverrideTemplate;
		});

		this.descriptionSubstitutionTemplates = $state(
			this[Raw].descriptionSubstitutionTemplates,
		);
		$effect(() => {
			this[Raw].descriptionSubstitutionTemplates =
				this.descriptionSubstitutionTemplates;
		});

		this.generationSeed = $state(this.computeGenerationSeed());
		$effect(() => {
			this.syncGenerationSeed(this.generationSeed);
		});

		this.trinketMetadata = $state(this[Raw].trinketMetadata);
		$effect(() => {
			this[Raw].trinketMetadata = this.trinketMetadata;
		});
	}

	private computeGenerationSeed(): number {
		this.ensureTrinket();
		if (this[Raw].generationSeed === undefined) {
			this[Raw].generationSeed = Math.floor(Math.random() * 9999999);
		}
		return this[Raw].generationSeed;
	}

	private syncGenerationSeed(value: number | undefined): void {
		if (value !== undefined) {
			this[Raw].generationSeed = value;
		}
	}

	static isSlotCompatible(slot: ParentIndex) {
		return slot === TRINKET_SLOT;
	}

	private ensureTrinket(): asserts this is TrinketProxy {
		if (this.info?._type !== "Trinket") {
			throw new TypeError(`Item "${this.name}" is not a Trinket`);
		}
	}
}
