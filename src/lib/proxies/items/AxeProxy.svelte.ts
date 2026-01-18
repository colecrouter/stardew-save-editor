import type { ToolItem } from "$types/save";
import { Raw } from "./ItemProxy.svelte";
import { ToolProxy } from "./ToolProxy.svelte";

export class AxeProxy extends ToolProxy {
	public additionalPower: number | undefined;

	constructor(raw: ToolItem) {
		super(raw);

		this.additionalPower = $state(this[Raw].additionalPower);
		$effect(() => {
			if (this.additionalPower !== undefined) {
				this[Raw].additionalPower = this.additionalPower;
			}
		});
	}
}
