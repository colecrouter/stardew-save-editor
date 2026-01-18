import type { ToolItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

export class ToolProxy extends BaseItemProxy<ToolItem> {
	public upgradeLevel: number | undefined;
	public numAttachmentSlots: number | undefined;
	public initialParentTileIndex: number | undefined;
	public currentParentTileIndex: number | undefined;
	public indexOfMenuItemView: number | undefined;
	public instantUse: boolean | undefined;
	public isEfficient: boolean | undefined;
	public animationSpeedModifier: number | undefined;

	constructor(raw: ToolItem) {
		super(raw);

		this.upgradeLevel = $state(this[Raw].upgradeLevel);
		$effect(() => {
			if (this.upgradeLevel !== undefined) {
				this[Raw].upgradeLevel = this.upgradeLevel;
			}
		});

		this.numAttachmentSlots = $state(this[Raw].numAttachmentSlots);
		$effect(() => {
			if (this.numAttachmentSlots !== undefined) {
				this[Raw].numAttachmentSlots = this.numAttachmentSlots;
			}
		});

		this.initialParentTileIndex = $state(this[Raw].initialParentTileIndex);
		$effect(() => {
			if (this.initialParentTileIndex !== undefined) {
				this[Raw].initialParentTileIndex = this.initialParentTileIndex;
			}
		});

		this.currentParentTileIndex = $state(this[Raw].currentParentTileIndex);
		$effect(() => {
			if (this.currentParentTileIndex !== undefined) {
				this[Raw].currentParentTileIndex = this.currentParentTileIndex;
			}
		});

		this.indexOfMenuItemView = $state(this[Raw].indexOfMenuItemView);
		$effect(() => {
			if (this.indexOfMenuItemView !== undefined) {
				this[Raw].indexOfMenuItemView = this.indexOfMenuItemView;
			}
		});

		this.instantUse = $state(this[Raw].instantUse);
		$effect(() => {
			if (this.instantUse !== undefined) {
				this[Raw].instantUse = this.instantUse;
			}
		});

		this.isEfficient = $state(this[Raw].isEfficient);
		$effect(() => {
			if (this.isEfficient !== undefined) {
				this[Raw].isEfficient = this.isEfficient;
			}
		});

		this.animationSpeedModifier = $state(this[Raw].animationSpeedModifier);
		$effect(() => {
			if (this.animationSpeedModifier !== undefined) {
				this[Raw].animationSpeedModifier = this.animationSpeedModifier;
			}
		});
	}
}
