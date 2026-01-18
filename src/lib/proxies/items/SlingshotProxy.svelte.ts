import type { ToolItem } from "$types/save";
import { Raw } from "./ItemProxy.svelte";
import { ToolProxy } from "./ToolProxy.svelte";

export class SlingshotProxy extends ToolProxy {
	public aimPosX: number | undefined;
	public aimPosY: number | undefined;
	public mouseDragAmount: number | undefined;
	public pullStartTime: number | undefined;
	public canPlaySound: boolean | undefined;

	constructor(raw: ToolItem) {
		super(raw);

		this.aimPosX = $state(this[Raw].aimPosX);
		$effect(() => {
			if (this.aimPosX !== undefined) {
				this[Raw].aimPosX = this.aimPosX;
			}
		});

		this.aimPosY = $state(this[Raw].aimPosY);
		$effect(() => {
			if (this.aimPosY !== undefined) {
				this[Raw].aimPosY = this.aimPosY;
			}
		});

		this.mouseDragAmount = $state(this[Raw].mouseDragAmount);
		$effect(() => {
			if (this.mouseDragAmount !== undefined) {
				this[Raw].mouseDragAmount = this.mouseDragAmount;
			}
		});

		this.pullStartTime = $state(this[Raw].pullStartTime);
		$effect(() => {
			if (this.pullStartTime !== undefined) {
				this[Raw].pullStartTime = this.pullStartTime;
			}
		});

		this.canPlaySound = $state(this[Raw].canPlaySound);
		$effect(() => {
			if (this.canPlaySound !== undefined) {
				this[Raw].canPlaySound = this.canPlaySound;
			}
		});
	}
}
