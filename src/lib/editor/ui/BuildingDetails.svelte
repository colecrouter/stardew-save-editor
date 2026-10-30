<script lang="ts">
	import BuildingSprite from "../../ui/BuildingSprite.svelte";
	import { Result } from "effect";
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
			<BuildingSprite {building} />
			<div>
				<p class="eyebrow">{building.location}</p>
				<h2>{building.name}</h2>
			</div>
		</div>
		{#if building.animalHouse}
			<span class="capacity">
				{building.residents} / {building.capacity ?? "?"} residents{building.outside
					? ` · ${building.outside} outside`
					: ""}
			</span>
		{/if}
	</header>
	{#if building.reason}
		<p role="status">{building.reason}</p>
	{/if}
	{#if building.construction || building.upgrading}
		<p role="status">
			{building.construction ? "Under construction" : "Upgrade in progress"}
		</p>
	{/if}
	{#if error}
		<p role="alert">{error}</p>
	{/if}
	{#each notices as notice}
		<p role="status">{notice}</p>
	{/each}
	{#if building.repaired !== undefined}
		<CheckboxField field={building.repair} />
	{/if}
	{#if building.tiers.length > 1}
		<form onsubmit={upgrade} class="tier">
			<label>
				Building tier
				<select
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
			<button
				type="submit"
				disabled={busy ||
					!selectedTier ||
					!!selectedTier.reason ||
					tier === building.name}
			>
				Apply tier
			</button>
			<p>
				Updates the interior, capacity and building progression together.
				Downgrades retain items that are in use or cannot move back. Undo
				restores the whole change.
			</p>
			{#if selectedTier?.reason}
				<p role="status">{selectedTier.reason}</p>
			{/if}
		</form>
	{/if}
	{#if building.animalHouse}
		<div class="section-title">
			<h3>Residents</h3>
			<span>Outside animals count toward capacity.</span>
		</div>
		{#if !building.animals.length}
			<p>No animals live here yet.</p>
		{/if}
		<div class="animals">
			{#each building.animals as animal (animal.id)}
				<AnimalCard {animal} />
			{/each}
		</div>
		<form class="adoption" onsubmit={adopt} aria-label="Adopt an animal">
			<h3>Adopt an animal</h3>
			<p>
				A new animal moves inside with full happiness and fullness. Adoption is
				free and can be undone.
			</p>
			{#if building.adoptionReason}
				<p role="status">{building.adoptionReason}</p>
			{/if}
			<div class="adoption-fields">
				<label>
					Animal type
					<select
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
			<button
				type="submit"
				disabled={busy ||
					!!building.adoptionReason ||
					!option?.allowed ||
					!ownerId ||
					!proposedName.trim()}
			>
				Adopt animal
			</button>
		</form>
	{/if}
</section>

<style>
	section {
		min-width: 0;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	h2 {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 32px;
		margin: 3px 0;
	}
	h3 {
		margin: 0;
		font-size: 20px;
	}
	.eyebrow {
		margin: 0;
		color: #795a36;
		font-size: 13px;
	}
	.capacity {
		font-size: 14px;
		border-radius: 18px;
		background: #efe1b9;
		padding: 8px 12px;
	}
	label {
		display: grid;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
	}
	input,
	select,
	button {
		font: inherit;
		border: 1px solid #ad7d45;
		border-radius: 6px;
		min-height: 40px;
		padding: 8px 10px;
		color: inherit;
		box-sizing: border-box;
		max-width: 100%;
	}
	input,
	select {
		background: #fffaf0;
		min-width: 0;
		width: 100%;
	}
	button {
		background: #efd29a;
		font-weight: 600;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.tier {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 12px;
		align-items: end;
		border-block: 1px solid #c7a16c;
		padding: 18px 0;
		margin-bottom: 24px;
	}
	.tier p {
		grid-column: 1 / -1;
		margin: 0;
		font-size: 13px;
		color: #6b5239;
	}
	.section-title {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
		align-items: baseline;
		margin-bottom: 16px;
	}
	.section-title span {
		font-size: 13px;
		color: #6b5239;
	}
	.animals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
		gap: 16px;
	}
	.adoption {
		border: 1px dashed #a57e42;
		border-radius: 10px;
		padding: 20px;
		margin-top: 24px;
	}
	.adoption p {
		font-size: 14px;
	}
	.adoption-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: 16px;
		margin-bottom: 16px;
	}
	[role="alert"] {
		color: #9a2c17;
	}
	@media (max-width: 500px) {
		.tier {
			grid-template-columns: minmax(0, 1fr);
		}
		.adoption {
			padding: 16px;
		}
	}
</style>
