import type { ObjectItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

export class ObjectProxy extends BaseItemProxy<ObjectItem> {
	public price: number | undefined;
	public edibility: number | undefined;

	constructor(raw: ObjectItem) {
		super(raw);

		this.price = $state(this.computePrice());
		$effect(() => this.syncPrice());

		this.edibility = $state(this.computeEdibility());
		$effect(() => this.syncEdibility());
	}

	private computePrice() {
		if (!this.info || this.info._type !== "Object") return undefined;
		return this[Raw].price;
	}

	private syncPrice() {
		if (this.price === undefined) return;
		if (this.price < 0) this.price = 0;
		if (this.price > 99999) this.price = 99999;
		this[Raw].price = this.price;
	}

	private computeEdibility() {
		if (!("edibility" in this[Raw]) || this[Raw].edibility === -300)
			return undefined;
		return this[Raw].edibility;
	}

	private syncEdibility() {
		if (this.edibility === undefined) return;
		this[Raw].edibility = this.edibility;
	}
}
