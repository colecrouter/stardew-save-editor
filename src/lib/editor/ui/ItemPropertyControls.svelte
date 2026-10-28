<script lang="ts">
	import type { EditorModel } from "../editor-model.ts";
	import type { ItemPropertyField } from "../item-properties.ts";
	import ItemPropertyControl from "./ItemPropertyControl.svelte";

	let {
		model,
		farmerId,
		entityId,
		fields,
	}: {
		model: EditorModel;
		farmerId: string;
		entityId: string;
		fields: readonly ItemPropertyField[];
	} = $props();
</script>

{#if fields.length}
	<div class="item-properties" role="group" aria-label="Item properties">
		{#each fields as field (field.property)}
			<ItemPropertyControl {model} {farmerId} {entityId} {field} />
		{/each}
	</div>
{/if}

<style>
	.item-properties {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px 16px;
		margin-top: 24px;
	}
	@media (max-width: 600px) {
		.item-properties {
			margin-top: 18px;
			gap: 16px 12px;
			font-size: 18px;
		}
	}
	@media (max-width: 359px) {
		.item-properties {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
