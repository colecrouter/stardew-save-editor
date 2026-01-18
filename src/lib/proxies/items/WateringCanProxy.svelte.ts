import type { ToolItem } from "$types/save";
import { Raw } from "./ItemProxy.svelte";
import { ToolProxy } from "./ToolProxy.svelte";

export class WateringCanProxy extends ToolProxy {
	public waterLeft: number | undefined;
	public isBottomless: boolean | undefined;
	public waterCanMax: number | undefined;

	constructor(raw: ToolItem) {
		super(raw);

		this.waterLeft = $state(this[Raw].waterLeft);
		$effect(() => {
			if (this.waterLeft !== undefined) {
				this[Raw].waterLeft = this.waterLeft;
			}
		});

		this.isBottomless = $state(this[Raw].isBottomless);
		$effect(() => {
			if (this.isBottomless !== undefined) {
				this[Raw].isBottomless = this.isBottomless;
			}
		});

		this.waterCanMax = $state(this[Raw].waterCanMax);
		$effect(() => {
			if (this.waterCanMax !== undefined) {
				this[Raw].waterCanMax = this.waterCanMax;
			}
		});
	}
}
