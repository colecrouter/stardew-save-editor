import { Color } from "$lib/proxies/Color.svelte";
import { ItemProxy, Raw } from "./ItemProxy";
import type { ColoredObjectItemModel } from "./types";

export class ColoredObjectProxy extends ItemProxy {
	constructor(raw: ColoredObjectItemModel) {
		super(raw);
		this.ensureColoredObject();
	}

	get objectColor() {
		const source = this[Raw].color;
		return source ? new Color(source) : undefined;
	}

	set objectColor(value) {
		if (!value) return;
		this[Raw].color = value;
	}

	private ensureColoredObject() {
		if (this.info?._type !== "Object") {
			throw new TypeError(`Item "${this.name}" is not a colored object`);
		}
	}
}
