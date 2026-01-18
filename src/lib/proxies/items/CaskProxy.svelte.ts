import type { CaskItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

export class CaskProxy extends BaseItemProxy<CaskItem> {
	public agingRate: number | undefined;
	public daysToMature: number | undefined;
	public heldItemQuality: number | undefined;

	constructor(raw: CaskItem) {
		super(raw);

		this.agingRate = $state(this[Raw].agingRate);
		$effect(() => {
			if (this.agingRate !== undefined) {
				this[Raw].agingRate = this.agingRate;
			}
		});

		this.daysToMature = $state(this[Raw].daysToMature);
		$effect(() => {
			if (this.daysToMature !== undefined) {
				this[Raw].daysToMature = this.daysToMature;
			}
		});

		this.heldItemQuality = $state(this.computeHeldItemQuality());
		$effect(() => this.syncHeldItemQuality());
	}

	private computeHeldItemQuality() {
		if (!this[Raw].heldObject) return undefined;
		return this[Raw].heldObject.quality;
	}

	private syncHeldItemQuality() {
		if (this.heldItemQuality === undefined) return;
		if (!this[Raw].heldObject) return;
		if (this.heldItemQuality < 0) this.heldItemQuality = 0;
		if (this.heldItemQuality === 3) this.heldItemQuality = 2;
		if (this.heldItemQuality > 4) this.heldItemQuality = 4;
		this[Raw].heldObject.quality = this.heldItemQuality;
	}
}
