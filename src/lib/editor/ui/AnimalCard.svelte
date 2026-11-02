<script lang="ts">
	import type { AnimalDomain } from "../building-domain.ts";
	import TextField from "./fields/TextField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import SelectField from "./fields/SelectField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	let { animal }: { animal: AnimalDomain } = $props();
</script>

<article aria-label={`${animal.name} animal`}>
	<header>
		<div>
			<h3>{animal.name}</h3>
			<span>{animal.type}</span>
		</div>
		{#if animal.outside}
			<small class="badge">Outside · {animal.location}</small>
		{/if}
	</header>

	<!-- Hearts make the game's five-heart friendship scale visible. The input
	     below retains the exact imported points, including unsupported values. -->
	{#if animal.friendship !== undefined}
		<div
			class="friendship"
			role="img"
			aria-label={`Friendship: ${animal.friendship} of 1,000 points`}
		>
			<div class="hearts" aria-hidden="true">
				{#each [0, 1, 2, 3, 4] as heart (heart)}
					<svg viewBox="0 0 16 16" width="22" height="22">
						<path
							fill="#bca17a"
							d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z"
						/>
						<path
							fill="#c44d3f"
							style:clip-path={`inset(0 ${100 - Math.max(0, Math.min(1, animal.friendship / 200 - heart)) * 100}% 0 0)`}
							d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z"
						/>
					</svg>
				{/each}
			</div>
			<span>Friendship</span>
		</div>
	{/if}

	{#if animal.reason}
		<StudyAlert title="Animal unavailable" tone="warning">
			<p>{animal.reason}</p>
		</StudyAlert>
	{/if}
	<div class="fields">
		<TextField field={animal.fields.name} sensitive />
		<NumberField field={animal.fields.daysOwned} />
		<SelectField field={animal.fields.gender} />
		<NumberField
			field={animal.fields.friendship}
			description="0–1,000 · 200 per heart"
		/>
		<NumberField field={animal.fields.happiness} description="0–255" />
		<NumberField field={animal.fields.fullness} description="0–255" />
	</div>
	<div class="toggles">
		{#if animal.canReproduce}
			<CheckboxField field={animal.fields.reproduction} />
		{/if}
		{#if animal.canEatCracker}
			<CheckboxField field={animal.fields.cracker} />
		{/if}
	</div>
</article>

<style>
	article {
		border: 2px solid #b98b52;
		background: #fff1d2;
		padding: 18px;
		min-width: 0;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: start;
		justify-content: space-between;
		margin-bottom: 12px;
	}
	h3 {
		margin: 0 0 4px;
		font-size: 26px;
		overflow-wrap: anywhere;
	}
	header span {
		color: #694621;
		font-size: 17px;
	}
	.badge {
		color: #486232;
		font-size: 16px;
		border-left: 3px solid #779454;
		padding: 4px 8px;
	}
	.friendship {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding-bottom: 14px;
		margin-bottom: 16px;
		border-bottom: 1px solid #d5b782;
	}
	.friendship > span {
		color: #795a36;
		font-size: 16px;
	}
	.hearts {
		display: flex;
		gap: 3px;
	}
	.hearts svg {
		display: block;
		flex: none;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px 14px;
	}
	.toggles {
		display: grid;
		gap: 12px;
		margin-top: 18px;
	}
	@media (max-width: 380px) {
		article {
			padding: 14px;
		}
		.fields {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
