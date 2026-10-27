<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import type { createRuneDraft } from "../field.svelte.ts";
	import type { FarmSettings } from "../farm-operations.ts";
	interface Props {
		model: EditorModel;
		draft: ReturnType<typeof createRuneDraft<FarmSettings>>;
	}
	let { model, draft }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const pending = useAtomValue(() => model.atomBindings.pending);
	const id = $props.id();
	const parts = $derived(
		JSON.parse(draft.current.text) as {
			name: string;
			profitPercent: string;
			monsters: boolean;
			mineRewards: string;
		},
	);
	// Every control updates only the local settings draft. The submitted command
	// compares it with its original source and writes only controls that changed.
	function edit<K extends keyof typeof parts>(
		key: K,
		value: (typeof parts)[K],
	) {
		draft.input(JSON.stringify({ ...parts, [key]: value }));
	}
</script>

{#if view.current}
	<header>
		<h1>Farm settings</h1>
		<p>
			Change shared farm settings without changing the farm’s map or creation
			rules.
		</p>
	</header>
	<section class="study-pane" aria-label="Farm settings">
		<form
			onsubmit={(event) => {
				event.preventDefault();
				void draft.submit();
			}}
		>
			<fieldset disabled={pending.current > 0 || draft.current.pending}>
				<legend>Editable settings</legend>
				<label>
					Farm name
					<input
						type="text"
						bind:value={() => parts.name, (value) => edit("name", value)}
						aria-describedby={`${id}-feedback`}
						data-sentry-mask
					/>
				</label>
				<label>
					Profit margin (%)
					<input
						type="number"
						min={Number(parts.profitPercent) ===
						draft.current.base.value.profitPercent
							? undefined
							: 1}
						max={Number(parts.profitPercent) ===
						draft.current.base.value.profitPercent
							? undefined
							: 1000}
						step="any"
						list={`${id}-profit-presets`}
						bind:value={
							() =>
								parts.profitPercent === ""
									? undefined
									: Number(parts.profitPercent),
							(value) =>
								edit("profitPercent", value === undefined ? "" : String(value))
						}
						aria-describedby={`${id}-profit-help ${id}-feedback`}
					/>
				</label>
				<datalist id={`${id}-profit-presets`}>
					{#each [100, 75, 50, 25] as percent (percent)}<option value={percent}
						></option>{/each}
				</datalist>
				<p id={`${id}-profit-help`} class="help">
					Multiplies sale and seed shop prices. 100% is normal. Name and profit
					changes update every farmer’s copy.
				</p>
				<label class="checkbox">
					<input
						type="checkbox"
						bind:checked={
							() => parts.monsters, (value) => edit("monsters", value)
						}
						aria-describedby={`${id}-monster-help`}
					/>
					Spawn monsters on the farm
				</label>
				<p id={`${id}-monster-help`} class="help">
					Allows monsters to spawn outdoors on the farm at night, from 7pm.
				</p>
				<label>
					Mine rewards
					<select
						bind:value={
							() => parts.mineRewards, (value) => edit("mineRewards", value)
						}
						aria-describedby={`${id}-rewards-help`}
					>
						{#if !["Default", "Remixed"].includes(parts.mineRewards)}<option
								value={parts.mineRewards}>Custom ({parts.mineRewards})</option
							>{/if}
						<option value="Default">Normal</option>
						<option value="Remixed">Remixed</option>
					</select>
				</label>
				<p id={`${id}-rewards-help`} class="help">
					Only changes chests you have not opened yet. Imported custom modes
					remain unchanged unless you choose another mode.
				</p>
			</fieldset>
			<div class="actions">
				<button
					type="submit"
					disabled={!draft.current.dirty ||
						draft.current.conflict ||
						pending.current > 0 ||
						draft.current.pending}>Apply farm settings</button
				>
				<button
					type="button"
					onclick={draft.reload}
					disabled={pending.current > 0 ||
						draft.current.pending ||
						(!draft.current.dirty && !draft.current.conflict)}
					>Reload farm settings</button
				>
			</div>
			<p id={`${id}-feedback`} role="status">
				{#if draft.current.error}{draft.current.error}
				{:else if draft.current.conflict}The save changed. Your farm settings
					draft is kept; reload before applying.
				{:else if draft.current.pending}Applying farm settings…
				{:else if draft.current.dirty}Unapplied farm settings draft.
				{:else}Farm settings match the save.{/if}
			</p>
		</form>
	</section>
	<details class="creation">
		<summary>Farm creation settings</summary>
		<dl>
			{#each view.current.farm.creation as setting (setting.label)}
				<div>
					<dt>{setting.label}</dt>
					<dd>{setting.value}</dd>
					<dd class="help">{setting.reason}</dd>
				</div>
			{/each}
		</dl>
	</details>
{/if}

<style>
	section {
		padding: 20px;
		max-width: 760px;
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
	label {
		display: grid;
		gap: 4px;
	}
	input,
	select,
	button {
		font: inherit;
		min-height: 40px;
		max-width: 100%;
	}
	input,
	select {
		width: 100%;
		padding: 5px 8px;
		background: #fff2d3;
		color: #351b0e;
		border: 2px solid #b98b52;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.checkbox input {
		width: 24px;
		height: 24px;
		min-height: 24px;
		flex: none;
	}
	.help {
		font-size: 19px;
		line-height: 1.2;
		color: #77542f;
		margin: 0 0 8px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}
	.creation {
		max-width: 760px;
		margin-top: 20px;
	}
	summary {
		cursor: pointer;
		min-height: 40px;
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
