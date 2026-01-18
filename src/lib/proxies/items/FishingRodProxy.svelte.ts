import type { ToolItem } from "$types/save";
import { Raw } from "./ItemProxy.svelte";
import { ToolProxy } from "./ToolProxy.svelte";

export class FishingRodProxy extends ToolProxy {
	public bobberX: number | undefined;
	public bobberY: number | undefined;
	public castDirection: number | undefined;
	public isFishing: boolean | undefined;
	public hit: boolean | undefined;
	public isNibbling: boolean | undefined;
	public isReeling: boolean | undefined;
	public fishSize: number | undefined;
	public fishQuality: number | undefined;
	public whichFish: string | undefined;

	constructor(raw: ToolItem) {
		super(raw);

		this.bobberX = $state(this[Raw].bobberX);
		$effect(() => {
			if (this.bobberX !== undefined) {
				this[Raw].bobberX = this.bobberX;
			}
		});

		this.bobberY = $state(this[Raw].bobberY);
		$effect(() => {
			if (this.bobberY !== undefined) {
				this[Raw].bobberY = this.bobberY;
			}
		});

		this.castDirection = $state(this[Raw].castDirection);
		$effect(() => {
			if (this.castDirection !== undefined) {
				this[Raw].castDirection = this.castDirection;
			}
		});

		this.isFishing = $state(this[Raw].isFishing);
		$effect(() => {
			if (this.isFishing !== undefined) {
				this[Raw].isFishing = this.isFishing;
			}
		});

		this.hit = $state(this[Raw].hit);
		$effect(() => {
			if (this.hit !== undefined) {
				this[Raw].hit = this.hit;
			}
		});

		this.isNibbling = $state(this[Raw].isNibbling);
		$effect(() => {
			if (this.isNibbling !== undefined) {
				this[Raw].isNibbling = this.isNibbling;
			}
		});

		this.isReeling = $state(this[Raw].isReeling);
		$effect(() => {
			if (this.isReeling !== undefined) {
				this[Raw].isReeling = this.isReeling;
			}
		});

		this.fishSize = $state(this[Raw].fishSize);
		$effect(() => {
			if (this.fishSize !== undefined) {
				this[Raw].fishSize = this.fishSize;
			}
		});

		this.fishQuality = $state(this[Raw].fishQuality);
		$effect(() => {
			if (this.fishQuality !== undefined) {
				this[Raw].fishQuality = this.fishQuality;
			}
		});

		this.whichFish = $state(this[Raw].whichFish);
		$effect(() => {
			if (this.whichFish !== undefined) {
				this[Raw].whichFish = this.whichFish;
			}
		});
	}
}
