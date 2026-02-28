import { Color } from "$lib/proxies/Color.svelte";
import type { ColoredObjectItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

export class ColoredObjectProxy extends BaseItemProxy<ColoredObjectItem> {
	public color: Color | undefined;

	constructor(raw: ColoredObjectItem) {
		super(raw);
		this.ensureColoredObject();

		this.color = $state(
			this[Raw].color ? new Color(this[Raw].color) : undefined,
		);
		$effect(() => {
			this[Raw].color = this.color;
		});
	}

	get objectColor() {
		const source = this[Raw].color;
		return source ? new Color(source) : undefined;
	}

	set objectColor(value) {
		if (!value) return;
		this[Raw].color = value;
	}

	get colorSameIndexAsParentSheetIndex() {
		return this[Raw].colorSameIndexAsParentSheetIndex ?? false;
	}

	set colorSameIndexAsParentSheetIndex(value: boolean) {
		this[Raw].colorSameIndexAsParentSheetIndex = value;
	}

	private ensureColoredObject(): asserts this is ColoredObjectProxy {
		if (this.info?._type !== "Object") {
			throw new TypeError(`Item "${this.name}" is not a colored object`);
		}
	}
}
