<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createFarmFields } from "../farm-domain.ts";
	import TextField from "./fields/TextField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import SelectField from "./fields/SelectField.svelte";
	import StudyPanel from "../../ui/kit/StudyPanel.svelte";
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";

	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const id = $props.id();
	const fields = $derived(
		view.current ? createFarmFields(view.current.farm, model) : undefined,
	);
</script>

{#if view.current && fields}
	<header class="farm-heading">
		<StudyIcon name="farm" size={40} />
		<div>
			<h1>Farm settings</h1>
			<p>Your farm’s name, rules and saved records.</p>
		</div>
	</header>
	<div class="farm-columns">
		<div class="rules">
			<StudyPanel title="Farm rules">
				<div class="fields">
					<TextField field={fields.name} sensitive />

					<NumberField
						field={fields.profitPercent}
						list={`${id}-profit-presets`}
						description="100% is normal. Scales sale and seed shop prices."
					/>

					<datalist id={`${id}-profit-presets`}>
						{#each [100, 75, 50, 25] as percent (percent)}
							<option value={percent}></option>
						{/each}
					</datalist>

					<CheckboxField
						field={fields.monsters}
						description="Monsters can appear outdoors from 7pm."
					/>

					<SelectField
						field={fields.mineRewards}
						description="Applies to unopened mine chests. Imported custom modes stay available in the selector."
					/>
				</div>
			</StudyPanel>
			<StudyAside title="Shared across farmers">
				<p>Farm name and profit margin update every farmer’s copy.</p>
			</StudyAside>
		</div>
		<div class="creation">
			<StudyPanel title="Farm creation settings" surface="inset">
				<p class="reference-note">Reference records from this save.</p>
				<dl>
					{#each view.current.farm.creation as setting (setting.label)}
						<div>
							<dt>{setting.label}</dt>
							<dd class="record-value">{setting.value}</dd>
							<dd class="help">{setting.reason}</dd>
						</div>
					{/each}
				</dl>
			</StudyPanel>
		</div>
	</div>
{/if}

<style>
	.farm-heading {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 20px;
	}
	h1 {
		font-size: 34px;
		margin: 0 0 8px;
	}
	.farm-heading p {
		color: #694621;
		margin: 0;
	}
	.farm-columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}
	.rules,
	.creation {
		min-width: 0;
	}
	.rules {
		display: grid;
		gap: 16px;
	}
	/* Keep the ordinary field adapters mounted in reading order. Visual grouping
    does not add a draft or change the shared-farmer transaction boundary. */
	.fields {
		display: grid;
		gap: 18px;
	}
	.fields :global(input[type="number"]) {
		max-width: 160px;
	}
	.fields :global(select) {
		max-width: 260px;
	}
	.reference-note {
		color: #79522d;
		font-size: 17px;
		margin: 0 0 6px;
	}
	dl {
		margin: 0;
	}
	/* Values read as recorded facts, with explanations directly underneath.
    Long/custom imported values wrap rather than widening the reference column. */
	dl > div {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: baseline;
		gap: 6px 12px;
		border-top: 1px solid #c6a16c;
		padding: 12px 0;
	}
	dl > div:first-child {
		border-top: 0;
	}
	dl > div:last-child {
		padding-bottom: 0;
	}
	dt {
		font-size: 18px;
		font-weight: bold;
		overflow-wrap: anywhere;
	}
	dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.record-value {
		max-width: 180px;
		color: #56351f;
		font-size: 18px;
		text-align: right;
	}
	.help {
		grid-column: 1 / -1;
		font-size: 16px;
		line-height: 1.35;
		color: #79522d;
	}
	@media (max-width: 1100px) {
		.farm-columns {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 480px) {
		h1 {
			font-size: 28px;
		}
		.farm-heading {
			gap: 10px;
			align-items: start;
		}
		.farm-heading :global(svg) {
			width: 32px;
			height: 32px;
		}
		/* Stack reference labels and values where long imported text would
           otherwise squeeze the label into a narrow column. */
		dl > div {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
		.record-value {
			max-width: none;
			text-align: left;
		}
	}
</style>
