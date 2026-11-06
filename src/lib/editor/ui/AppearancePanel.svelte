<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createAppearanceDomain } from "../appearance-domain.ts";
	import TextField from "./fields/TextField.svelte";
	import StepperField from "./fields/StepperField.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import SelectField from "./fields/SelectField.svelte";
	import ColorField from "./fields/ColorField.svelte";
	import AppearancePreview from "./AppearancePreview.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	interface Props {
		model: EditorModel;
		oninventory: () => void;
	}
	let { model, oninventory }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const selected = $derived(
		view.current?.appearances.find(
			(owner) => owner.farmerId === selection.current,
		),
	);
	const domain = $derived(
		selected && view.current
			? createAppearanceDomain(selected, model)
			: undefined,
	);
</script>

{#if domain?.supported}
	{#key domain.farmerId}
		<div class="appearance-layout">
			<aside aria-label="Farmer preview">
				<h2 data-sentry-mask="">{domain.name.value ?? "Farmer"}</h2>

				<AppearancePreview preview={domain.preview} />

				<div class="preview-note">
					<StudyButton onclick={oninventory}>
						Edit clothing in Inventory
					</StudyButton>
				</div>
			</aside>

			<div class="dresser">
				<section aria-label="Identity">
					<h2>Identity</h2>

					<div class="field-grid">
						<TextField field={domain.name} sensitive />
						<TextField field={domain.favorite} sensitive />
						<SelectField field={domain.gender} />
					</div>
				</section>

				<section class="style-controls" aria-label="Style">
					<h2>Style</h2>

					<div class="field-grid">
						{#each domain.numbers as field (field.key)}
							<StepperField {field} />
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
	/* Arrow targets reserve 44px each; give every style selector a full row,
	   even where identity and color fields can comfortably share columns. */
	.dresser .style-controls .field-grid {
		grid-template-columns: minmax(0, 1fr);
	}
	section[aria-label="Identity"] .field-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
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
		section[aria-label="Identity"] .field-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
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
	}
	@media (max-width: 380px) {
		section[aria-label="Identity"] .field-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.field-grid,
		section:not(:first-child) .field-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
