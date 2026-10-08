import type { ParentIndex } from "$lib/ItemParentIndex";
import {
	clampStats,
	createRandom,
	findSeedForStats,
	isEditableTrinket,
	rollTrinket,
	sameStats,
	statSaveFields,
	type TrinketKind,
	type TrinketRollContext,
	type TrinketStats,
} from "$lib/TrinketStats";
import type { Trinket as TrinketInfo } from "$types/items";
import type { TrinketItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

const TRINKET_SLOT: ParentIndex = "trinketItem";

const nilString = { string: { "@_xsi:nil": "true" } };

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

	/** Which editable trinket this is, or `undefined` if its stats can't be edited. */
	get statKind(): TrinketKind | undefined {
		const key = this.trinketKey;
		return isEditableTrinket(key) ? key : undefined;
	}

	/** The stats the game will roll from this trinket's seed. */
	getStats(ctx: TrinketRollContext): TrinketStats | undefined {
		const kind = this.statKind;
		if (!kind) return undefined;
		return rollTrinket(
			kind,
			createRandom(this.generationSeed ?? 0, ctx.useLegacyRandom),
			ctx,
		);
	}

	/**
	 * Pick a new seed that rolls `target` (clamped to values the game can roll).
	 * Returns whether the stats were applied.
	 */
	setStats(target: TrinketStats, ctx: TrinketRollContext): boolean {
		const current = this.getStats(ctx);
		if (!current || current.kind !== target.kind) return false;
		const seed = sameStats(current, clampStats(target, ctx))
			? (this.generationSeed ?? 0)
			: findSeedForStats(target, ctx);
		if (seed === undefined) return false;
		this.applySeed(seed, ctx);
		return true;
	}

	/**
	 * Set the seed and mirror what the game's `GenerateRandomStats` writes, so the
	 * save is consistent even before the game re-rolls the stats on load.
	 */
	private applySeed(seed: number, ctx: TrinketRollContext): void {
		this.generationSeed = seed;
		const stats = this.getStats(ctx);
		if (!stats) return;
		const { templates, displayName } = statSaveFields(stats);
		if (templates) {
			this.descriptionSubstitutionTemplates = {
				string: templates.length === 1 ? templates[0] : templates,
			};
		}
		if (displayName !== undefined) {
			this.displayNameOverrideTemplate =
				displayName === null ? nilString : { string: displayName };
		}
	}

	private get trinketKey(): string {
		return String(this[Raw].itemId ?? this.name).replace(/^\(TR\)/, "");
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
