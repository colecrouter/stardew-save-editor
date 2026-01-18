import type { Furniture as FurnitureInfo } from "$types/items";
import type { FurnitureItem } from "$types/save";
import { ItemProxy, Raw } from "./ItemProxy";

export class FurnitureProxy extends ItemProxy<FurnitureItem> {
	readonly furnitureInfo: FurnitureInfo;

	constructor(raw: FurnitureItem) {
		super(raw);
		this.furnitureInfo = this.ensureFurniture();
	}

	get boundingBox() {
		return this[Raw].boundingBox;
	}

	set boundingBox(value) {
		if (!value) return;
		this[Raw].boundingBox = value;
	}

	get rotationCount() {
		return this[Raw].rotations;
	}

	set rotationCount(value) {
		this[Raw].rotations = value;
	}

	get currentRotation() {
		return this[Raw].currentRotation;
	}

	set currentRotation(value) {
		if (value === undefined) return;
		this[Raw].currentRotation = value;
	}

	rotate(by = 1) {
		const total = this.rotationCount ?? 1;
		const current = this.currentRotation ?? 0;
		this.currentRotation = (current + by + total) % total;
	}

	private ensureFurniture(): FurnitureInfo {
		if (this.info?._type !== "Furniture") {
			throw new TypeError(`Item "${this.name}" is not Furniture`);
		}
		return this.info;
	}
}
