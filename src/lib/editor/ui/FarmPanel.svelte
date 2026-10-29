<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createFarmFields } from "../farm-domain.ts";
	import TextField from "./fields/TextField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import SelectField from "./fields/SelectField.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const id = $props.id();
	const fields = $derived(
		view.current ? createFarmFields(view.current.farm, model) : undefined,
	);
</script>

{#if view.current && fields}
	<header>
		<h1>Farm settings</h1>
		<p>
			Change shared farm settings without changing the farm’s map or creation
			rules.
		</p>
	</header>
	<div class="farm-columns">
		<section class="study-pane" aria-label="Editable farm settings">
			<fieldset>
				<legend>Editable settings</legend>
				<TextField field={fields.name} sensitive />

				<NumberField
					field={fields.profitPercent}
					list={`${id}-profit-presets`}
					description="Multiplies sale and seed shop prices. 100% is normal. Name and profit changes update every farmer’s copy."
				/>

				<datalist id={`${id}-profit-presets`}>
					{#each [100, 75, 50, 25] as percent (percent)}
						<option value={percent}></option>
					{/each}
				</datalist>

				<CheckboxField
					field={fields.monsters}
					description="Allows monsters to spawn outdoors on the farm at night, from 7pm."
				/>

				<SelectField
					field={fields.mineRewards}
					description="Only changes chests you have not opened yet. Imported custom modes remain unchanged unless you choose another mode."
				/>
			</fieldset>
			<p role="status">
				Changes update immediately. Use Undo to revert a completed edit.
			</p>
		</section>
		<section class="creation" aria-label="Farm creation settings">
			<h2>Farm creation settings</h2>
			<dl>
				{#each view.current.farm.creation as setting (setting.label)}
					<div>
						<dt>{setting.label}</dt>
						<dd>{setting.value}</dd>
						<dd class="help">{setting.reason}</dd>
					</div>
				{/each}
			</dl>
		</section>
	</div>
{/if}

<style>
	.farm-columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}
	section {
		min-width: 0;
	}
	.study-pane {
		padding: 20px;
	}
	.creation h2 {
		margin: 0 0 20px;
	}
	@media (max-width: 1100px) {
		.farm-columns {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	header p {
		margin: 0 0 16px;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	legend {
		margin-bottom: 12px;
	}
	.help {
		font-size: 19px;
		line-height: 1.2;
		color: #77542f;
		margin: 0 0 8px;
	}
	dl {
		margin: 8px 0;
	}
	dl div {
		margin-bottom: 14px;
	}
	dt {
		font-weight: bold;
	}
	dd {
		margin: 2px 0;
		overflow-wrap: anywhere;
	}
</style>
