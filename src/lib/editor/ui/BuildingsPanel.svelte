<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import {
		createBuildingDomain,
		createAnimalDomain,
	} from "../building-domain.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import BuildingDetails from "./BuildingDetails.svelte";
	import AnimalCard from "./AnimalCard.svelte";
	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const farmer = useAtomValue(() => model.atomBindings.selectedFarmerId);
	let buildingId = $state<string>();
	const buildings = $derived(view.current?.buildings);
	const selected = $derived(
		buildings?.buildings.find((row) => row.id === buildingId) ??
			buildings?.buildings[0],
	);
	const domain = $derived(
		selected ? createBuildingDomain(selected, model) : undefined,
	);
	const ownerField = $derived(
		createFarmerSelectionField(
			view.current?.farmerChoices ?? [],
			farmer.current,
			model,
		),
	);
	const takenNames = $derived(
		[
			...(buildings?.buildings.flatMap((row) => row.animals) ?? []),
			...(buildings?.unhoused ?? []),
		].map((animal) => animal.name),
	);
</script>

<h1>Buildings &amp; animals</h1>
<p class="intro">
	Care for your animals and manage their homes. Field edits update immediately;
	use Undo to revert.
</p>
{#if buildings?.buildings.length}
	<div class="workspace">
		<nav aria-label="Buildings">
			{#each buildings.buildings as row (row.id)}
				<button
					type="button"
					aria-pressed={selected?.id === row.id}
					onclick={() => {
						void model.edits.endActive();
						buildingId = row.id;
					}}
				>
					<strong>{row.name}</strong>
					<span>{row.location}</span>
					{#if row.animalHouse}
						<small>{row.residents} / {row.capacity ?? "?"} animals</small>
					{/if}
					{#if !row.supported}
						<small>Read-only</small>
					{/if}
				</button>
			{/each}
		</nav>
		<div class="details">
			{#if domain}
				{#key domain.id}
					<BuildingDetails
						building={domain}
						{ownerField}
						ownerId={farmer.current}
						{takenNames}
					/>
				{/key}
			{/if}
		</div>
	</div>
{:else}
	<p>No buildings were found in this save.</p>
{/if}
{#if buildings?.unhoused.length}
	<section class="unhoused" aria-label="Animals without a listed home">
		<h2>Animals without a listed home</h2>
		<p>
			These animals exist in a location but are not listed as a resident of a
			discovered building. Editing their fields does not reassign a home.
		</p>
		<div class="animals">
			{#each buildings.unhoused as row (row.id)}
				<AnimalCard animal={createAnimalDomain(row, model)} />
			{/each}
		</div>
	</section>
{/if}

<style>
	h1 {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 34px;
		margin: 0 0 8px;
	}
	.intro {
		color: #6b5239;
		margin: 0 0 24px;
		max-width: 70ch;
	}
	.workspace {
		display: grid;
		grid-template-columns: 205px minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}
	nav {
		display: grid;
		gap: 8px;
	}
	nav button {
		display: grid;
		gap: 5px;
		text-align: left;
		font: inherit;
		color: inherit;
		border: 1px solid #bd945f;
		border-radius: 8px;
		background: #f7e9cd;
		padding: 12px 14px;
		cursor: pointer;
		min-width: 0;
	}
	nav button[aria-pressed="true"] {
		background: #efce92;
		border: 2px solid #815422;
		padding: 11px 13px;
	}
	nav span,
	nav small {
		color: #735334;
		font-size: 12px;
	}
	nav strong {
		font-size: 16px;
	}
	.details {
		min-width: 0;
	}
	.unhoused {
		margin-top: 28px;
	}
	.animals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
		gap: 16px;
	}
	@media (max-width: 750px) {
		.workspace {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
		}
		nav {
			display: flex;
			overflow-x: auto;
			padding-bottom: 4px;
		}
		nav button {
			flex: 0 0 150px;
		}
		h1 {
			font-size: 29px;
		}
	}
</style>
