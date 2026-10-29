<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createAppearanceDomain } from "../appearance-domain.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import TextField from "./fields/TextField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import SelectField from "./fields/SelectField.svelte";
	import ColorField from "./fields/ColorField.svelte";
	import AppearancePreview from "./AppearancePreview.svelte";
	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.characters ?? [],
			selection.current,
			model,
		),
	);
	const selected = $derived(
		view.current?.appearances.find(
			(owner) => owner.farmerId === selection.current,
		),
	);
	const domain = $derived(
		selected && view.current
			? createAppearanceDomain(selected, view.current.farm, model)
			: undefined,
	);
</script>

<div class="heading">
	<h1>Appearance</h1>
	<FarmerSelector field={farmerField} />
</div>
{#if domain?.supported}
	<p>Changes update immediately. Use Undo to revert.</p>
	{#key domain.farmerId}
		<div class="appearance-layout">
			<aside>
				<AppearancePreview appearance={domain.preview} />
				<SelectField field={domain.gender} />
				{#each domain.numbers as field (field.key)}
					<NumberField {field} />
				{/each}
			</aside>
			<section aria-label="Character details and colors">
				<TextField field={domain.name} sensitive />
				<TextField field={domain.farmName} sensitive />
				<TextField field={domain.favorite} sensitive />
				{#each domain.colors as field (field.key)}
					<ColorField {field} />
				{/each}
			</section>
		</div>
	{/key}
{:else}
	<p role="status">{domain?.reason ?? "No supported farmer is available."}</p>
{/if}

<style>
	.heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		flex-wrap: wrap;
		gap: 16px;
	}
	h1 {
		margin: 0;
	}
	.appearance-layout {
		display: grid;
		grid-template-columns: minmax(220px, 1fr) minmax(0, 2fr);
		gap: 28px;
		align-items: start;
	}
	aside,
	section {
		display: grid;
		gap: 18px;
		min-width: 0;
	}
	@media (max-width: 650px) {
		.appearance-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
