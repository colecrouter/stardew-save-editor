<script lang="ts">
	import BuildingSprite from "../../ui/BuildingSprite.svelte";
	import StudyTooltip from "../../ui/kit/StudyTooltip.svelte";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import { Result } from "effect";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import "../../ui/kit/styles.css";
	import { describeUnplaced } from "../../animalBuildings.ts";
	import { defaultAnimalName } from "../../animalBuildingData.ts";
	import type { BuildingDomain } from "../building-domain.ts";
	import type { ImmediateField } from "../immediate-field.ts";
	import AnimalCard from "./AnimalCard.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	let {
		building,
		ownerField,
		ownerId,
		takenNames,
	}: {
		building: BuildingDomain;
		ownerField: ImmediateField<string>;
		ownerId?: string;
		takenNames: readonly string[];
	} = $props();
	// These drafts coordinate consequences rather than delaying ordinary field edits.
	// Parent keys this component by building ID, so its pending targets never drift.
	let target = $state("");
	let animalType = $state("");
	let name = $state<string | undefined>();
	let busy = $state(false);
	let error = $state("");
	let notices = $state<string[]>([]);
	const tier = $derived(target || building.name);
	const option = $derived(
		building.animalOptions.find((row) => row.type === animalType) ??
			building.animalOptions.find((row) => row.allowed),
	);
	const proposedName = $derived(
		name ?? defaultAnimalName(option?.type ?? "Animal", new Set(takenNames)),
	);
	const selectedTier = $derived(
		building.tiers.find((row) => row.name === tier),
	);
	async function upgrade(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		error = "";
		notices = [];
		try {
			const result = await building.upgrade(tier);
			if (result && Result.isFailure(result)) error = result.failure.message;
			if (result && Result.isSuccess(result)) {
				notices = result.success.map(describeUnplaced);
				target = "";
			}
		} finally {
			busy = false;
		}
	}
	async function adopt(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !option || !ownerId) return;
		busy = true;
		error = "";
		notices = [];
		try {
			const result = await building.adopt(option.type, proposedName, ownerId);
			if (result && Result.isFailure(result)) error = result.failure.message;
			if (result && Result.isSuccess(result)) name = undefined;
		} finally {
			busy = false;
		}
	}
</script>

<section aria-label={`${building.name} details`}>
	<header>
		<div class="identity">
			<BuildingSprite {building} size={96} />
			<div>
				<h2>{building.name}</h2>
				<p class="location">{building.location}</p>
				{#if building.animalHouse}
					<p class="capacity">
						{building.residents} / {building.capacity ?? "?"} residents
					</p>
					{#if building.capacity !== undefined && building.capacity > 0}
						<meter
							min="0"
							max={building.capacity}
							value={building.residents}
							aria-label="Building occupancy"
						></meter>
					{/if}
					{#if building.outside}
						<p class="outside">
							{building.outside} outside · included in capacity
						</p>
					{/if}
				{/if}
			</div>
		</div>
	</header>
	{#if building.description}
		<p class="description">{building.description}</p>
	{/if}

	{#if building.constructionCost && (building.constructionCost.gold || building.constructionCost.materials.length)}
		<aside class="construction-cost" aria-label="In-game construction cost">
			<p>In-game construction cost</p>

			<div class="materials">
				{#if building.constructionCost.gold}
					<span>{building.constructionCost.gold.toLocaleString()}g</span>
				{/if}

				{#each building.constructionCost.materials as material (material.name)}
					<StudyTooltip
						text={material.name}
						aria-label={`${material.amount.toLocaleString()} ${material.name}`}
						class="material"
					>
						<BackpackItemVisual visual={material.visual} />
						<span>{material.amount.toLocaleString()}</span>
					</StudyTooltip>
				{/each}
			</div>

			<small>Reference only. Editing does not spend gold or materials.</small>
		</aside>
	{/if}
	{#if building.reason}
		<StudyAlert title="Read-only building" tone="warning">
			<p>{building.reason}</p>
		</StudyAlert>
	{/if}
	{#if building.construction || building.upgrading}
		<StudyAlert
			title={building.construction
				? "Under construction"
				: "Upgrade in progress"}
		>
			<p>Some building actions are unavailable until construction finishes.</p>
		</StudyAlert>
	{/if}
	{#if error}
		<StudyAlert title="Change unavailable" tone="danger" live="assertive">
			<p>{error}</p>
		</StudyAlert>
	{/if}
	{#each notices as notice}
		<StudyAlert
			title="Interior change needs attention"
			tone="warning"
			live="polite"
		>
			<p>{notice}</p>
		</StudyAlert>
	{/each}
	{#if building.repaired !== undefined}
		<CheckboxField field={building.repair} />
	{/if}
	{#if building.tiers.length > 1}
		<form onsubmit={upgrade} class="tier study-theme">
			<label>
				Building tier
				<select
					class="study-input"
					value={tier}
					onchange={(event) => {
						target = event.currentTarget.value;
					}}
					disabled={busy}
				>
					{#each building.tiers as row (row.name)}
						<option value={row.name} disabled={!!row.reason} title={row.reason}>
							{row.name}
						</option>
					{/each}
				</select>
			</label>
			<StudyButton
				type="submit"
				intent="constructive"
				disabled={busy ||
					!selectedTier ||
					!!selectedTier.reason ||
					tier === building.name}
			>
				Apply tier
			</StudyButton>
			<details class="tier-note">
				<summary>What changes with a tier?</summary>

				<StudyAside title="Changing tiers">
					Tier changes update the interior, capacity and progression together.
					Items that cannot move back during a downgrade are retained.
				</StudyAside>
			</details>
			{#if selectedTier?.reason}
				<p role="status">{selectedTier.reason}</p>
			{/if}
		</form>
	{/if}
	{#if building.animalHouse}
		<div class="section-title">
			<h3>Residents</h3>
			<span>{building.animals.length} listed here</span>
		</div>
		{#if !building.animals.length}
			<p>No animals live here yet.</p>
		{/if}
		<!-- Adoption is an explicit consequence draft, disclosed separately from
		     the resident fields. Opening this form creates no saved animal. -->
		<details class="adoption">
			<summary>Adopt an animal</summary>

			<form class="study-theme" onsubmit={adopt} aria-label="Adopt an animal">
				<p>
					Choose a resident to move into this home. New animals start inside,
					happy and fed; no gold is deducted.
				</p>
				{#if building.adoptionReason}
					<p role="status">{building.adoptionReason}</p>
				{/if}
				<div class="adoption-fields">
					<label>
						Animal type
						<select
							class="study-input"
							value={option?.type ?? ""}
							onchange={(event) => {
								animalType = event.currentTarget.value;
								name = undefined;
							}}
							disabled={busy || !!building.adoptionReason}
						>
							{#each building.animalOptions as row (row.type)}
								<option value={row.type} disabled={!row.allowed}>
									{row.type}{row.reason ? ` · ${row.reason}` : ""}
								</option>
							{/each}
						</select>
					</label>
					<label>
						New animal name
						<input
							class="study-input"
							value={proposedName}
							oninput={(event) => {
								name = event.currentTarget.value;
							}}
							disabled={busy || !!building.adoptionReason}
							data-sentry-mask=""
						/>
					</label>
					<FarmerSelector field={ownerField} />
				</div>
				{#if !building.animalOptions.length}
					<p>This building has no known compatible animal types.</p>
				{/if}
				<StudyButton
					type="submit"
					intent="constructive"
					variant="filled"
					disabled={busy ||
						!!building.adoptionReason ||
						!option?.allowed ||
						!ownerId ||
						!proposedName.trim()}
				>
					Adopt animal
				</StudyButton>
			</form>
		</details>
		<div class="animals">
			{#each building.animals as animal (animal.id)}
				<AnimalCard {animal} />
			{/each}
		</div>
	{/if}
</section>

<style>
	.construction-cost {
		margin: 0.7rem 0;
	}
	.construction-cost p {
		margin: 0 0 0.3rem;
	}
	.materials {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.materials :global(.material) {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.3rem;
	}
	.construction-cost small {
		display: block;
		margin-top: 0.3rem;
	}
	section {
		min-width: 0;
	}
	header {
		margin-bottom: 24px;
		padding: 20px;
		background: #f7e3ba;
		border: 2px solid #b98b52;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 28px;
		min-width: 0;
	}
	.identity > div {
		min-width: 0;
	}
	h2 {
		font-size: 32px;
		margin: 0 0 6px;
		overflow-wrap: anywhere;
	}
	h3 {
		margin: 0;
		font-size: 24px;
	}
	.location {
		margin: 0 0 14px;
		color: #795a36;
	}
	.capacity {
		margin: 0 0 6px;
		font-size: 20px;
	}
	.outside {
		margin: 6px 0 0;
		color: #694621;
		font-size: 16px;
	}
	meter {
		width: 180px;
		max-width: 100%;
		height: 12px;
		display: block;
		accent-color: #648146;
	}
	label {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.tier {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 12px;
		margin: 22px 0 28px;
	}
	.tier-note,
	.tier > p {
		grid-column: 1 / -1;
		margin: 0;
	}
	.section-title {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 14px;
		border-bottom: 2px solid #b98b52;
		padding-bottom: 10px;
	}
	.section-title span {
		color: #694621;
		font-size: 17px;
	}
	.animals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
		gap: 18px;
	}
	.adoption {
		margin: 0 0 20px;
		border: 2px solid #b98b52;
		background: #f7e3ba;
	}
	summary {
		padding: 12px 16px;
		min-height: 44px;
		box-sizing: border-box;
		cursor: pointer;
		color: #486232;
	}
	summary:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	.adoption form {
		padding: 0 16px 16px;
	}
	.adoption p {
		margin: 0 0 16px;
		color: #694621;
		font-size: 17px;
	}
	.adoption-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: 16px;
		margin-bottom: 16px;
	}
	@media (max-width: 1100px) {
		.identity {
			gap: 20px;
		}
		header {
			padding: 16px;
		}
	}
	@media (max-width: 500px) {
		.identity {
			gap: 16px;
		}
		h2 {
			font-size: 26px;
		}
		.tier {
			grid-template-columns: minmax(0, 1fr);
		}
		header {
			padding: 12px;
		}
	}
</style>
