<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { setFarmSettings, type FarmSettings } from "../farm-operations.ts";

	interface Props {
		model: EditorModel;
	}

	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const id = $props.id();
	const savedName = $derived(view.current?.farm.name ?? "");
	const savedProfit = $derived(view.current?.farm.profitPercent ?? 100);
	let name = $state("");
	let profit = $state("");
	let saving = $state<Partial<Record<keyof FarmSettings, boolean>>>({});
	let error = $state("");

	// Subscribe to each committed value separately: unrelated history actions must
	// not replace incomplete text while someone is typing. Undo/redo of that value
	// refreshes the control automatically; there is no page-wide unapplied draft.
	$effect(() => {
		name = savedName;
	});
	$effect(() => {
		profit = String(savedProfit);
	});

	async function commit<K extends keyof FarmSettings>(
		field: K,
		value: FarmSettings[K],
	) {
		if (saving[field]) return;
		saving[field] = true;
		error = "";
		try {
			// Lock only the submitted control: clicking another setting may first
			// blur a text field, and both independent edits must reach the queue.
			// A control submits only its own setting. The queued transaction reads
			// the latest document, so independent edits do not overwrite one another.
			const result = await model.commands.transact(
				setFarmSettings({ [field]: value }),
			);
			if (result && Result.isFailure(result))
				error = `${result.failure.message} The current save value was kept.`;
			// Defects and cancellation stay with the shared command/toast boundary.
		} finally {
			saving[field] = false;
		}
	}

	async function commitText(field: "name" | "profitPercent") {
		if (saving[field]) return;
		const value =
			field === "name"
				? name
				: profit.trim() === ""
					? Number.NaN
					: Number(profit);
		if (field === "name" ? value === savedName : value === savedProfit) return;
		if (field === "name") await commit(field, String(value));
		else await commit(field, Number(value));
		// Invalid or interrupted input falls back to the current committed value.
		// A complete name or percentage contributes exactly one undoable action.
		if (field === "name") name = savedName;
		else profit = String(savedProfit);
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
	<div class="farm-columns">
		<section class="study-pane" aria-label="Editable farm settings">
			<fieldset>
				<legend>Editable settings</legend>
				<label>
					Farm name
					<input
						type="text"
						disabled={saving.name}
						bind:value={name}
						onblur={() => void commitText("name")}
						onkeydown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								void commitText("name");
							}
						}}
						aria-describedby={`${id}-feedback`}
						data-sentry-mask
					/>
				</label>
				<label>
					Profit margin (%)
					<input
						type="number"
						disabled={saving.profitPercent}
						step="any"
						list={`${id}-profit-presets`}
						value={profit}
						oninput={(event) => {
							profit = event.currentTarget.value;
						}}
						onblur={() => void commitText("profitPercent")}
						onkeydown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								void commitText("profitPercent");
							}
						}}
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
						disabled={saving.monsters}
						checked={view.current.farm.monsters}
						onchange={async (event) => {
							const control = event.currentTarget;
							await commit("monsters", control.checked);
							control.checked = view.current?.farm.monsters ?? false;
						}}
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
						disabled={saving.mineRewards}
						value={view.current.farm.mineRewards}
						onchange={async (event) => {
							const control = event.currentTarget;
							await commit("mineRewards", control.value);
							control.value = view.current?.farm.mineRewards ?? "Default";
						}}
						aria-describedby={`${id}-rewards-help`}
					>
						{#if !["Default", "Remixed"].includes(view.current.farm.mineRewards)}<option
								value={view.current.farm.mineRewards}
								>Custom ({view.current.farm.mineRewards})</option
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
			<p id={`${id}-feedback`} role="status">
				{#if error}{error}{:else}Leave a text field or press Enter to update it.
					Choices update immediately. Use Undo to revert.{/if}
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
	label {
		display: grid;
		gap: 4px;
	}
	input,
	select {
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
