import type { ToolItem } from "$types/save";
import { ToolProxy } from "./ToolProxy.svelte";

export class PanProxy extends ToolProxy {
	constructor(raw: ToolItem) {
		super(raw);

		// Validate minimum upgrade level for Pan
		$effect(() => {
			if (this.upgradeLevel !== undefined && this.upgradeLevel < 1) {
				this.upgradeLevel = 1;
			}
		});
	}
}
