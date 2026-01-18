import type { Furniture as FurnitureInfo, FurnitureType } from "$types/items";
import type { BoundingBox, FurnitureItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

export class FurnitureProxy extends BaseItemProxy<FurnitureItem> {
	readonly furnitureInfo: FurnitureInfo;

	public furnitureType: FurnitureType | undefined;
	public rotations: number | undefined;
	public currentRotation: number | undefined;
	public sourceIndexOffset: number | undefined;
	public drawPosition: { X: number; Y: number } | undefined;
	public sourceRect: BoundingBox | undefined;
	public defaultSourceRect: BoundingBox | undefined;
	public defaultBoundingBox: BoundingBox | undefined;
	public drawHeldObjectLow: boolean | undefined;

	constructor(raw: FurnitureItem) {
		super(raw);
		this.ensureFurniture();
		this.furnitureInfo = this.info as FurnitureInfo;

		this.furnitureType = $state(this[Raw].furniture_type);
		$effect(() => {
			this[Raw].furniture_type = this.furnitureType;
		});

		this.rotations = $state(this[Raw].rotations);
		$effect(() => {
			this[Raw].rotations = this.rotations;
		});

		this.currentRotation = $state(this[Raw].currentRotation);
		$effect(() => {
			if (this.currentRotation !== undefined) {
				this[Raw].currentRotation = this.currentRotation;
			}
		});

		this.sourceIndexOffset = $state(this[Raw].sourceIndexOffset);
		$effect(() => {
			this[Raw].sourceIndexOffset = this.sourceIndexOffset;
		});

		this.drawPosition = $state(this[Raw].drawPosition);
		$effect(() => {
			this[Raw].drawPosition = this.drawPosition;
		});

		this.sourceRect = $state(this[Raw].sourceRect);
		$effect(() => {
			this[Raw].sourceRect = this.sourceRect;
		});

		this.defaultSourceRect = $state(this[Raw].defaultSourceRect);
		$effect(() => {
			this[Raw].defaultSourceRect = this.defaultSourceRect;
		});

		this.defaultBoundingBox = $state(this[Raw].defaultBoundingBox);
		$effect(() => {
			this[Raw].defaultBoundingBox = this.defaultBoundingBox;
		});

		this.drawHeldObjectLow = $state(this[Raw].drawHeldObjectLow);
		$effect(() => {
			this[Raw].drawHeldObjectLow = this.drawHeldObjectLow;
		});
	}

	rotate(by = 1) {
		const total = this.rotations ?? 1;
		const current = this.currentRotation ?? 0;
		this.currentRotation = (current + by + total) % total;
	}

	private ensureFurniture(): asserts this is FurnitureProxy {
		if (this.info?._type !== "Furniture") {
			throw new TypeError(`Item "${this.name}" is not Furniture`);
		}
	}
}
