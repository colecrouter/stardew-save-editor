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
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.farmerChoices ?? [],
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
	<div>
		<h1>Appearance</h1>
		<p class="intro">A new look for your farmer.</p>
	</div>

	<FarmerSelector field={farmerField} />
</div>

{#if domain?.supported}
	{#key domain.farmerId}
		<div class="appearance-layout">
			<aside aria-label="Farmer preview">
				<h2 data-sentry-mask="">{domain.name.value ?? "Farmer"}</h2>

				<AppearancePreview preview={domain.preview} />

				<p class="preview-note">
					Clothing follows the equipped items in Inventory.
				</p>
			</aside>

			<div class="dresser">
				<section aria-label="Identity">
					<h2>Identity</h2>

					<div class="field-grid">
						<TextField field={domain.name} sensitive />
						<TextField field={domain.farmName} sensitive />
						<TextField field={domain.favorite} sensitive />
						<SelectField field={domain.gender} />
					</div>
				</section>

				<section aria-label="Style">
					<h2>Style</h2>

					<div class="field-grid">
						{#each domain.numbers as field (field.key)}
							<NumberField {field} />
						{/each}
					</div>
				</section>

				<section aria-label="Colors">
					<h2>Colors</h2>

					<div class="field-grid">
						{#each domain.colors as field (field.key)}
							<ColorField {field} />
						{/each}
					</div>
				</section>
			</div>
		</div>
	{/key}
{:else}
	<StudyAlert title="Appearance unavailable" tone="warning">
		<p>{domain?.reason ?? "No supported farmer is available."}</p>
	</StudyAlert>
{/if}

<style>
	.heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		flex-wrap: wrap;
		gap: 16px;
		margin-bottom: 24px;
	}
	h1 {
		margin: 0;
		font-size: 32px;
	}
	.intro {
		margin: 8px 0 0;
		color: #694621;
	}
	.appearance-layout {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		max-width: 960px;
		gap: 24px;
		align-items: start;
	}
	aside {
		min-width: 0;
		background: #f5dbab;
		border: 2px solid #b98b52;
		padding: 18px;
		position: sticky;
		top: 0;
	}
	aside h2 {
		text-align: center;
		overflow-wrap: anywhere;
		margin-bottom: 16px;
	}
	h2 {
		font-size: 25px;
		margin: 0 0 18px;
	}
	.preview-note {
		color: #694621;
		font-size: 17px;
		line-height: 1.4;
		margin: 16px 0 0;
	}
	.dresser {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
		min-width: 0;
	}
	section:first-child {
		grid-column: 1 / -1;
	}
	section:not(:first-child) .field-grid {
		grid-template-columns: minmax(0, 1fr);
	}
	section {
		border: 2px solid #b98b52;
		background: #fff1d2;
		padding: 20px;
		min-width: 0;
	}
	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px 16px;
	}
	@media (max-width: 1000px) {
		.dresser {
			grid-template-columns: minmax(0, 1fr);
		}
		section:not(:first-child) .field-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 650px) {
		.appearance-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		aside {
			position: static;
		}
		section {
			padding: 16px;
		}
		h1 {
			font-size: 28px;
		}
	}
	@media (max-width: 380px) {
		.field-grid,
		section:not(:first-child) .field-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
