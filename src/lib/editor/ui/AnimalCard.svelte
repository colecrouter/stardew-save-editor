<script lang="ts">
	import type { AnimalDomain } from "../building-domain.ts";
	import TextField from "./fields/TextField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import SelectField from "./fields/SelectField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
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
	{#if animal.reason}
		<p role="status">{animal.reason}</p>
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
		border: 1px solid #ad7d45;
		border-radius: 10px;
		background: #fff8e8;
		padding: 18px;
		min-width: 0;
	}
	header {
		display: flex;
		gap: 12px;
		align-items: start;
		justify-content: space-between;
		margin-bottom: 18px;
	}
	h3 {
		margin: 0 0 4px;
		font-size: 21px;
	}
	header span {
		color: #6b5239;
		font-size: 14px;
	}
	.badge {
		border: 1px solid #aa834d;
		padding: 4px 8px;
		border-radius: 16px;
		font-size: 12px;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}
	.toggles {
		display: grid;
		gap: 12px;
		margin-top: 16px;
	}
	@media (max-width: 450px) {
		.fields {
			grid-template-columns: minmax(0, 1fr);
		}
		header {
			flex-wrap: wrap;
		}
	}
</style>
