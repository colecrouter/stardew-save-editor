<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createRelationshipDomain } from "../relationship-domain.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import ConfirmAction from "./ConfirmAction.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import { Result } from "effect";
	import { Villagers } from "../../Villagers.ts";
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
		view.current?.relationships.find(
			(farmer) => farmer.farmerId === selection.current,
		),
	);
	const domain = $derived(
		selected ? createRelationshipDomain(selected, model) : undefined,
	);
	let search = $state("");
	let pending = $state(false);
	let feedback = $state<{ farmerId: string; message: string } | undefined>();
	// Alphabetical ordering is stable across point edits and Undo. Keeping the row
	// under the same pointer/focus matters more than continuously ranking friendship.
	const shown = $derived(
		(domain?.relationships ?? [])
			.filter((row) =>
				row.name.toLowerCase().includes(search.trim().toLowerCase()),
			)
			.toSorted((a, b) => a.name.localeCompare(b.name)),
	);
	async function addVillager(name: string) {
		const target = domain;
		if (!target || pending) return;
		pending = true;
		feedback = undefined;
		try {
			const result = await target.relationships
				.find((row) => row.name === name)
				?.add();
			// A captured operation may finish after selection changes. Its data still
			// belongs to the original farmer; feedback belongs only to the current one.
			if (
				domain?.farmerId === target.farmerId &&
				result &&
				Result.isFailure(result)
			)
				feedback = {
					farmerId: target.farmerId,
					message: result.failure.message,
				};
		} finally {
			pending = false;
		}
	}
</script>

<div class="heading">
	<h1>Relationships</h1>
	<FarmerSelector field={farmerField} />
</div>

{#if domain?.supported}
	<p>
		Changes update immediately. Use Undo to revert. Hearts change friendship
		points without changing relationship status.
	</p>
	<div class="toolbar">
		<label>
			Search villagers <input
				class="ui-control"
				type="search"
				bind:value={search}
			/>
		</label>
	</div>
	{#if feedback?.farmerId === domain.farmerId}
		<p role="alert">{feedback.message}</p>
	{/if}
	{#key domain.farmerId}
		<div class="relationships">
			{#each shown as row (row.name)}
				<section
					class:missing={!row.present}
					aria-label={`${row.name} relationship`}
				>
					<h2>{row.name}</h2>
					{#if row.present}
						<ConfirmAction
							title={`Remove ${row.name}?`}
							description="This removes their saved relationship, including friendship points and gift history. You can Undo this change."
							label={`Remove ${row.name}`}
							disabled={!row.supported || pending}
							commit={row.remove}
						/>
					{:else}
						<p class="missing-label">Not in this farmer's save</p>
						<button
							class="ui-control ui-button"
							type="button"
							disabled={pending}
							onclick={() => addVillager(row.name)}
						>
							Add {row.name}
						</button>
					{/if}
					{#if Villagers.get(row.name)?.description}
						<p class="description">{Villagers.get(row.name)?.description}</p>
					{/if}
					<div class="fields">
						<NumberField field={row.fields.hearts} />
						<NumberField field={row.fields.points} />
						<NumberField field={row.fields.gifts} />
					</div>
				</section>
			{:else}
				<p>No villagers match your search.</p>
			{/each}
		</div>
	{/key}
	<small>
		Villager descriptions from <a href="https://stardewvalleywiki.com">
			Stardew Valley Wiki
		</a>
		, licensed under
		<a href="https://creativecommons.org/licenses/by-nc-sa/3.0/">
			CC BY-NC-SA 3.0
		</a>
		.
	</small>
{:else}
	<p role="status">{domain?.reason ?? "No supported farmer is available."}</p>
{/if}

<style>
	.heading,
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0 0 8px;
	}
	.relationships {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
		margin: 24px 0;
	}
	section {
		border-top: 1px solid #bb925e;
		padding: 20px 0;
		min-width: 0;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.missing .fields {
		opacity: 0.55;
	}
	.missing-label {
		font-style: italic;
	}
	.description {
		color: #694621;
		font-size: 17px;
		line-height: 1.3;
	}
	input,
	button {
		font: inherit;
	}
	@media (max-width: 1000px) {
		.relationships {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 480px) {
		.fields {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
