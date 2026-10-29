<script lang="ts">
	import type { InventoryPropertyField } from "../inventory-domain.ts";
	import NumberField from "./fields/NumberField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import SelectField from "./fields/SelectField.svelte";
	import ColorField from "./fields/ColorField.svelte";
	interface Props {
		field: InventoryPropertyField;
	}
	let { field }: Props = $props();
</script>

<div class="property" title={field.title}>
	{#if field.kind === "number"}
		<NumberField
			field={field.field}
			description={field.hint}
			readonly={field.readonly}
		/>
	{:else if field.kind === "boolean"}
		<CheckboxField field={field.field} description={field.hint} />
	{:else if field.kind === "color"}
		<ColorField field={field.field} description={field.hint} />

		<span class="color-value">{field.field.value}</span>
	{:else}
		<SelectField field={field.field} description={field.hint} />
	{/if}
</div>

<style>
	.color-value {
		font-size: 18px;
		color: #694621;
	}
	.property {
		min-width: 0;
	}
</style>
