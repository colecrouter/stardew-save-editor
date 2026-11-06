<script lang="ts">
	import type { ImmutableView } from "../immutable-view.ts";
	import type { CharacterDetailsView } from "../character-details.ts";
	import { createCharacterDetailsDomain } from "../character-details-domain.ts";
	import type { EditorModel } from "../editor-model.ts";
	import SelectField from "./fields/SelectField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	interface Props {
		details: ImmutableView<CharacterDetailsView>;
		farmerId: string;
		model: EditorModel;
	}
	let { details, farmerId, model }: Props = $props();
	const fields = $derived(
		createCharacterDetailsDomain(details, farmerId, model),
	);
	// Count only explicit unlocked values; unavailable flags are not assumed true.
	const collected = $derived(
		fields.wallet.filter((field) => field.value === true).length,
	);
</script>

<div class="records">
	<section class="record" aria-label="Stats and upgrades">
		<header>
			<h2>
				<StudyIcon name="character" size={28} />
				Stats and upgrades
			</h2>
			<p>House level {fields.houseLevel ?? "—"}</p>
		</header>

		<div class="backpack">
			<SelectField
				field={fields.backpack}
				description="To shrink a backpack, empty its last slots on Inventory first."
			/>
		</div>

		<!-- The domain supplies labels, availability and field lifetimes. This ledger
	     changes only their arrangement; every imported value stays represented. -->
		<div class="details-grid">
			{#each fields.numbers as field (field.key)}
				<NumberField {field} />
			{/each}
		</div>

		{#if fields.houseUpgrading}
			<div class="house-action">
				<CheckboxField
					field={fields.cancelHouse}
					description="Stop Robin's current upgrade without a refund."
				/>
			</div>
		{/if}

		<!-- Detailed game rules stay available beside the fields without filling the
	     first view. Opening this disclosure does not change any saved value. -->
		<details>
			<summary>About upgrades and mine progress</summary>

			<div class="notes">
				<p>
					One house upgrade day finishes after the next sleep; the game moves
					furniture. Cancelling does not refund the purchase. Farmhands must
					play for their timer to advance.
				</p>
				<p>
					Clint's tool timer: 0 means ready to collect. Trash can levels 0–4
					reclaim 0–60% of the sale price.
				</p>
				<p>Mine floors 1–120 are the Mines; 121 onward is Skull Cavern.</p>
			</div>
		</details>
	</section>

	<section class="record" aria-label="Wallet">
		<header>
			<h2>
				<StudyIcon name="inventory" size={28} />
				Wallet
			</h2>
			<p>
				{collected} / {fields.wallet.length} collected
			</p>
		</header>

		<div class="wallet-grid">
			{#each fields.wallet as field (field.key)}
				<div class="wallet-entry">
					<CheckboxField {field} />
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.records {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr);
		gap: 20px;
		align-items: start;
	}
	.records .details-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.records .wallet-grid {
		grid-template-columns: minmax(0, 1fr);
	}
	.record {
		padding: 20px;
		border: 2px solid #b98b52;
		background: #fff1d2;
		margin-bottom: 24px;
		min-width: 0;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 20px;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 14px;
		margin-bottom: 18px;
		border-bottom: 1px solid #d5b782;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-size: 24px;
	}
	header p {
		margin: 0;
		color: #79522d;
		font-size: 17px;
	}
	.backpack {
		max-width: 430px;
		margin-bottom: 22px;
	}
	.details-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
	}
	.house-action {
		margin-top: 20px;
	}
	details {
		border-top: 1px solid #d5b782;
		margin-top: 22px;
	}
	summary {
		padding: 12px 0 0;
		min-height: 44px;
		box-sizing: border-box;
		cursor: pointer;
		color: #694621;
	}
	summary:focus-visible {
		outline: 2px solid #754522;
		outline-offset: 2px;
	}
	.notes {
		display: grid;
		gap: 10px;
		padding-top: 12px;
	}
	.notes p {
		margin: 0;
		font-size: 17px;
		color: #694621;
		line-height: 1.35;
	}
	.wallet-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.wallet-entry {
		padding: 8px 12px;
		background: #f7e3ba;
		border: 1px solid #d5b782;
		min-width: 0;
	}
	@media (max-width: 1100px) {
		.records {
			grid-template-columns: minmax(0, 1fr);
		}
		.details-grid,
		.wallet-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 600px) {
		.record {
			padding: 16px;
		}
		.records .details-grid,
		.records .wallet-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
