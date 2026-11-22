<script lang="ts">
	import {
		type CollectionEntry,
		collectionFields,
	} from "../collection-fields.ts";
	import { collectionPresentation } from "../collection-presentation.ts";
	import type { EditorModel } from "../editor-model.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import NumberField from "./fields/NumberField.svelte";

	let {
		model,
		farmerId,
		kind,
		row,
		onediting,
	}: {
		model: EditorModel;
		farmerId: string;
		kind: "shipping" | "fishing";
		row: CollectionEntry;
		onediting: (active: boolean) => void;
	} = $props();
	const fields = $derived(collectionFields(model, farmerId, kind, row));
	const presentation = $derived(collectionPresentation(row.id));
</script>

<section
	class:missing={!row.recorded}
	aria-label={`${row.name} (${row.id}) ${kind} record`}
>
	<div class="summary">
		<BackpackItemVisual visual={presentation.visual} />

		<div class="identity">
			<h3>{row.name}</h3>

			<span class:recorded={row.recorded}>
				{row.recorded ? "Recorded" : "Not recorded"}
			</span>

			{#if row.reason}
				<span>· Read-only</span>
			{/if}
		</div>

		<!-- IDs disambiguate same-name objects, but stay secondary to item identity. -->
		<small title="Item ID">#{row.id}</small>
	</div>

	<div class="controls">
		<NumberField
			field={{
				...fields.count,
				label: kind === "shipping" ? "Shipped" : "Caught",
			}}
			aria-label={fields.count.label}
			onfocus={() => onediting(true)}
			onblur={() => onediting(false)}
		/>

		<CheckboxField
			field={{ ...fields.recorded, label: "Recorded" }}
			aria-label={fields.recorded.label}
			onfocus={() => onediting(true)}
			onblur={() => onediting(false)}
		/>
	</div>

	{#if kind === "fishing"}
		<p class="size">Saved largest size: {row.size ?? 0}</p>
	{/if}
</section>

<style>
	section {
		border: 1px solid #b98b52;
		background: #fff1d2;
		padding: 10px;
		min-width: 0;
	}
	section.missing {
		background: #f1ddb6;
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 42px;
	}
	.identity {
		flex: 1;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 20px;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}
	span,
	small,
	.size {
		font-size: 15px;
		color: #694621;
	}
	.recorded {
		color: #246f44;
	}
	small {
		overflow-wrap: anywhere;
		max-width: 30%;
	}
	.controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 8px;
		margin-top: 8px;
	}
	.controls :global(.editor-field) {
		gap: 2px;
	}
	.controls :global(label) {
		font-size: 16px;
	}
	.controls :global(input[type="number"]) {
		min-height: 36px;
		height: 36px;
		padding: 3px 6px;
	}
	.size {
		margin: 6px 0 0;
	}
	@media (pointer: coarse) {
		.controls :global(input[type="number"]) {
			min-height: 44px;
			height: 44px;
		}
	}
</style>
