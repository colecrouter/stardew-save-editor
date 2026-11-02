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
	import BuildingSprite from "../../ui/BuildingSprite.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
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
	Find a home, care for its residents, or welcome a new animal.
</p>

{#if buildings?.buildings.length}
	<div class="workspace">
		<nav aria-label="Buildings">
			<h2>
				Your buildings <span>{buildings.buildings.length}</span>
			</h2>

			<!-- The roster scrolls independently on desktop. A native selector on
			     narrow screens keeps the selected building close to its details. -->
			<div class="compact-picker">
				<StudyField label="Building">
					{#snippet children(attributes)}
						<select
							{...attributes}
							class="study-input"
							value={selected?.id}
							onchange={(event) => {
								void model.edits.endActive();
								buildingId = event.currentTarget.value;
							}}
						>
							{#each buildings.buildings as row, index (row.id)}
								<option value={row.id}>
									{row.name} · {row.location} · {index + 1}
								</option>
							{/each}
						</select>
					{/snippet}
				</StudyField>
			</div>

			<div class="roster">
				{#each buildings.buildings as row (row.id)}
					<button
						type="button"
						aria-pressed={selected?.id === row.id}
						onclick={() => {
							void model.edits.endActive();
							buildingId = row.id;
						}}
					>
						<BuildingSprite building={row} size={48} />

						<span class="building-label">
							<strong>{row.name}</strong>
							<span>{row.location}</span>
							{#if row.animalHouse}
								<small>{row.residents} / {row.capacity ?? "?"} animals</small>
							{/if}
							{#if !row.supported}
								<small>Read-only</small>
							{/if}
						</span>
					</button>
				{/each}
			</div>
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
	<StudyAlert title="No buildings found">
		<p>This save has no discovered buildings to edit.</p>
	</StudyAlert>
{/if}

{#if buildings?.unhoused.length}
	<section class="unhoused" aria-label="Animals without a listed home">
		<StudyAlert title="Animals without a listed home" tone="warning">
			<p>
				These animals are not listed as residents of a discovered building.
				Editing their fields does not reassign a home.
			</p>
		</StudyAlert>

		<div class="animals">
			{#each buildings.unhoused as row (row.id)}
				<AnimalCard animal={createAnimalDomain(row, model)} />
			{/each}
		</div>
	</section>
{/if}

<style>
	h1 {
		font-size: 32px;
		margin: 0 0 8px;
	}
	.intro {
		color: #694621;
		margin: 0 0 24px;
	}
	.workspace {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		gap: 26px;
		align-items: start;
	}
	nav {
		min-width: 0;
	}
	nav h2 {
		font-size: 22px;
		margin: 0 0 14px;
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	nav h2 span {
		color: #79522d;
		font-size: 18px;
	}
	.roster {
		display: grid;
		gap: 10px;
		max-height: 680px;
		overflow-y: auto;
		padding: 6px;
		scrollbar-gutter: stable;
	}
	.roster button {
		display: grid;
		grid-template-columns: 60px minmax(0, 1fr);
		gap: 12px;
		align-items: center;
		text-align: left;
		font: inherit;
		color: inherit;
		border: 2px solid #b98b52;
		background: #f5dbab;
		padding: 12px 8px;
		cursor: pointer;
		min-width: 0;
	}
	.roster button:hover {
		background: #ffe9bb;
	}
	.roster button[aria-pressed="true"] {
		background: #fff1d2;
		border-color: #754522;
		box-shadow: inset 4px 0 #a45826;
	}
	.roster button:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	.building-label {
		display: grid;
		gap: 4px;
		overflow-wrap: anywhere;
	}
	.building-label span,
	.building-label small {
		color: #735334;
		font-size: 16px;
	}
	.building-label strong {
		font-size: 20px;
	}
	.details {
		min-width: 0;
	}
	.compact-picker {
		display: none;
	}
	.unhoused {
		margin-top: 28px;
	}
	.animals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
		gap: 18px;
		margin-top: 18px;
	}
	@media (max-width: 1100px) {
		.workspace {
			grid-template-columns: 200px minmax(0, 1fr);
			gap: 20px;
		}
		.roster button {
			grid-template-columns: minmax(0, 1fr);
		}
		.roster button :global(.wrapper) {
			display: none;
		}
	}
	@media (max-width: 750px) {
		.workspace {
			grid-template-columns: minmax(0, 1fr);
			gap: 22px;
		}
		.roster,
		nav h2 {
			display: none;
		}
		.compact-picker {
			display: block;
		}
		h1 {
			font-size: 28px;
		}
	}
</style>
