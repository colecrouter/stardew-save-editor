<script lang="ts">
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { bindImmediateField } from "../field-binding.ts";
	import type { ImmutableView } from "../immutable-view.ts";
	import type { ProgressFarmer } from "../progress-data.ts";
	import { setCropShipment } from "../shipment-operations.ts";
	import NumberField from "./fields/NumberField.svelte";

	let {
		model,
		farmer,
	}: { model: EditorModel; farmer: ImmutableView<ProgressFarmer> | undefined } =
		$props();
	let search = $state("");
	let cropId = $state("");
	const rows = $derived(
		(farmer?.shipments ?? []).filter((row) =>
			row.name.toLowerCase().includes(search.trim().toLowerCase()),
		),
	);
	const crop = $derived(rows.find((row) => row.id === cropId) ?? rows[0]);

	// Capture both identities in the shared immediate-field binding. A late edit
	// stays attached to the farmer and crop that owned the displayed input.
	const field = $derived.by(() => {
		if (!farmer || !crop) return undefined;
		const { farmerId } = farmer;
		const { id, name, ambiguous, count } = crop;
		return bindImmediateField(
			model,
			{
				key: `crop-shipment:${JSON.stringify([farmerId, id])}`,
				label: `${name} shipped count`,
				value: count,
				available: !ambiguous,
				reason: ambiguous
					? "This crop has duplicate shipment records."
					: undefined,
				constraints: { min: 1, max: 2147483647, step: 1 },
			},
			(value: number) =>
				setCropShipment({ farmerId, itemId: id, count: value }),
		);
	});
</script>

<StudyAside title="Crop shipments">
	{#if (farmer?.shipments.length ?? 0) > 0}
		<p>
			Set a positive shipment count for {farmer?.name}. Recorded awards are
			separate from these counts.
		</p>

		<label>
			Find a crop
			<input
				class="study-input"
				type="search"
				bind:value={search}
			/>
		</label>

		{#if crop && field}
			<label>
				Crop
				<select
					class="study-input"
					value={crop.id}
					onchange={(event) => {
						cropId = event.currentTarget.value;
					}}
				>
					{#each rows as row (row.id)}
						<option value={row.id}>{row.name}</option>
					{/each}
				</select>
			</label>

			{#key field.key}
				<NumberField {field} />
			{/key}
		{:else}
			<p>No matching crops.</p>
		{/if}
	{:else}
		<p>Choose a farmer with a readable shipment collection.</p>
	{/if}
</StudyAside>

<style>
	label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-block: 8px;
	}

	input,
	select {
		max-width: 100%;
	}
</style>
