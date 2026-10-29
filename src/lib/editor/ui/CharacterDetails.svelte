<script lang="ts">
	import type { CharacterDetailsView } from "../character-details.ts";
	import { createCharacterDetailsDomain } from "../character-details-domain.ts";
	import type { EditorModel } from "../editor-model.ts";
	import SelectField from "./fields/SelectField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	interface Props {
		details: CharacterDetailsView;
		farmerId: string;
		model: EditorModel;
	}
	let { details, farmerId, model }: Props = $props();
	const fields = $derived(
		createCharacterDetailsDomain(details, farmerId, model),
	);
</script>

<section aria-label="Stats and upgrades">
	<h2>Stats and upgrades</h2>

	<SelectField
		field={fields.backpack}
		description="To shrink a backpack, empty its last slots on Inventory first."
	/>

	<div class="details-grid">
		{#each fields.numbers as field (field.key)}
			<NumberField {field} />
		{/each}
	</div>

	<p>
		House level: {fields.houseLevel ?? "unsupported"}. One upgrade day finishes
		after the next sleep; the game moves furniture. Cancelling does not refund
		the purchase. Farmhands must play for their timer to advance.
	</p>

	{#if fields.houseUpgrading}
		<CheckboxField
			field={fields.cancelHouse}
			description="Stop Robin's current upgrade without a refund."
		/>
	{/if}

	<p>
		Clint's tool timer: 0 means ready to collect. Trash can levels 0–4 reclaim
		0–60% of the sale price. Mine floors 1–120 are the Mines; 121 onward is
		Skull Cavern.
	</p>
</section>

<section aria-label="Wallet">
	<h2>Wallet</h2>

	<div class="details-grid">
		{#each fields.wallet as field (field.key)}
			<CheckboxField {field} />
		{/each}
	</div>
</section>

<style>
	section {
		padding: 22px 0;
		border-top: 1px solid #bb925e;
	}
	h2 {
		margin: 0 0 16px;
		font-size: 24px;
	}
	.details-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	p {
		font-size: 17px;
		color: #694621;
		line-height: 1.3;
	}
	@media (max-width: 600px) {
		.details-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
