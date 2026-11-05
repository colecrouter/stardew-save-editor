<script lang="ts">
	import { Result } from "effect";
	import type { CommunityBundleDomain } from "../community-domain.ts";
	import {
		BUNDLE_QUALITIES,
		MAX_BUNDLE_ITEMS,
		MAX_GOLD,
		MAX_INGREDIENT_STACK,
		canHaveQuality,
		ingredientChoices,
		ingredientName,
	} from "../community-ingredients.ts";
	import StudyDialog from "../../ui/kit/StudyDialog.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	interface Props {
		bundle: CommunityBundleDomain;
		disabled?: boolean;
	}
	let { bundle, disabled = false }: Props = $props();
	interface DraftRow {
		id: number;
		sourceIndex?: number;
		itemId: string;
		quantity: number;
		quality: number;
	}
	let open = $state(false);
	let busy = $state(false);
	let error = $state("");
	let rows = $state<DraftRow[]>([]);
	let needed = $state(1);
	let picking = $state<number>();
	let search = $state("");
	let nextId = 0;
	let apply: CommunityBundleDomain["editRequirements"];
	const vault = $derived(bundle.room === 4);
	const choices = $derived(
		ingredientChoices
			.filter((row) =>
				`${row.name} ${row.id}`
					.toLowerCase()
					.includes(search.trim().toLowerCase()),
			)
			.slice(0, 40),
	);
	function show(value: boolean) {
		if (value) {
			// This is one coordinated transaction: browsing and cancelling the draft
			// never write the save, and later projection updates do not reset its inputs.
			rows = bundle.requirements.map((row, index) => ({
				id: index,
				sourceIndex: index,
				itemId: row.itemId,
				quantity: row.quantity,
				quality: row.quality,
			}));
			nextId = rows.length;
			needed = bundle.needed;
			apply = bundle.editRequirements;
			error = "";
			picking = undefined;
			search = "";
		}
		open = value;
	}
	function choose(itemId: string) {
		const row = rows.find((row) => row.id === picking);
		if (row) {
			row.itemId = itemId;
			if (!canHaveQuality(itemId)) row.quality = 0;
		}
		picking = undefined;
	}
	async function save() {
		if (busy) return;
		busy = true;
		error = "";
		try {
			const requirements = rows.map(({ id: _id, ...row }) => row);
			// The Vault stores price in quality too when that was its imported encoding.
			if (vault) {
				const prior = bundle.requirements.at(-1);
				const last = requirements.at(-1);
				if (prior && last && prior.quantity === prior.quality)
					last.quality = last.quantity;
			}
			const result = await apply(requirements, needed);
			if (!result) return;
			if (Result.isFailure(result)) error = result.failure.message;
			else open = false;
		} finally {
			busy = false;
		}
	}
</script>

<StudyDialog
	trigger="Edit requirements"
	title={`Edit ${bundle.name} requirements`}
	description="Change what this bundle asks for. Donations stay with their existing rows; this does not spend items or gold."
	bind:open={() => open, show}
	dismissible={!busy}
	disabled={disabled || !bundle.supported}
>
	<fieldset class="draft study-theme" disabled={busy}>
		<legend class="sr-only">Bundle requirements</legend>

		{#if vault}
			<p>Vault bundles are bought with gold. Only the price can change.</p>

			{@const price = rows.at(-1)}
			{#if price}
				<label>
					Price in gold
					<input
						class="study-input"
						type="number"
						min="1"
						max={MAX_GOLD}
						bind:value={price.quantity}
					/>
				</label>
			{/if}
		{:else}
			<div class="rows">
				{#each rows as row, index (row.id)}
					<div class="ingredient">
						<StudyButton
							onclick={() => {
								picking = picking === row.id ? undefined : row.id;
								search = "";
							}}
							aria-label={`Change requirement ${index + 1}: ${ingredientName(row.itemId)}`}
						>
							{ingredientName(row.itemId)}
						</StudyButton>

						<label>
							Quantity
							<input
								class="study-input"
								type="number"
								min="1"
								max={MAX_INGREDIENT_STACK}
								bind:value={row.quantity}
								aria-label={`Quantity for requirement ${index + 1}`}
							/>
						</label>

						<label>
							Minimum quality
							<select
								class="study-input"
								bind:value={row.quality}
								aria-label={`Minimum quality for requirement ${index + 1}`}
							>
								{#each [...BUNDLE_QUALITIES] as [quality, label] (quality)}
									<option
										value={quality}
										disabled={quality > 0 && !canHaveQuality(row.itemId)}
									>
										{label}
									</option>
								{/each}
								{#if !BUNDLE_QUALITIES.has(row.quality)}
									<option value={row.quality}>
										Imported quality {row.quality}
									</option>
								{/if}
							</select>
						</label>

						<StudyButton
							intent="destructive"
							disabled={rows.length === 1}
							aria-label={`Remove requirement ${index + 1}`}
							onclick={() => {
								rows = rows.filter((item) => item.id !== row.id);
								needed = Math.min(needed, rows.length);
								if (picking === row.id) picking = undefined;
							}}
						>
							Remove
						</StudyButton>
					</div>
				{/each}
			</div>

			{#if picking !== undefined}
				<section class="picker" aria-label="Choose bundle requirement">
					<label>
						Search items or categories
						<input class="study-input" type="search" bind:value={search} />
					</label>

					<div class="choices">
						{#each choices as choice (choice.id)}
							<button
								type="button"
								class="study-button"
								onclick={() => choose(choice.id)}
							>
								{choice.name}
							</button>
						{/each}
					</div>

					{#if !choices.length}<p>No matching items.</p>{/if}
					<p>Showing up to 40 matches. Search to narrow the list.</p>
				</section>
			{/if}

			<div class="controls">
				<StudyButton
					disabled={rows.length >= MAX_BUNDLE_ITEMS}
					onclick={() => {
						const row = {
							id: nextId++,
							itemId: "390",
							quantity: 1,
							quality: 0,
						};
						rows = [...rows, row];
						picking = row.id;
						search = "";
					}}
				>
					Add requirement
				</StudyButton>

				<label>
					Donations needed
					<input
						class="study-input"
						type="number"
						min="1"
						max={rows.length}
						bind:value={needed}
					/>
				</label>
			</div>
		{/if}
	</fieldset>

	<p class="note">
		An edit cannot finish or reopen the bundle. Change its donations separately
		first.
	</p>

	{#if error}
		<StudyAlert
			title="Requirements could not be changed"
			tone="danger"
			live="assertive"
		>
			<p>{error}</p>
		</StudyAlert>
	{/if}

	{#snippet actions(close)}
		<StudyButton onclick={close} disabled={busy}>Cancel</StudyButton>

		<StudyButton
			intent="constructive"
			variant="filled"
			pending={busy}
			onclick={() => void save()}
		>
			Apply requirements
		</StudyButton>
	{/snippet}
</StudyDialog>

<style>
	.draft {
		border: 0;
		padding: 0;
		min-width: 0;
	}
	.draft label {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.rows {
		display: grid;
		gap: 12px;
	}
	.ingredient {
		display: grid;
		grid-template-columns:
			minmax(140px, 2fr) minmax(70px, 1fr) minmax(110px, 1fr)
			auto;
		gap: 10px;
		align-items: end;
		border-bottom: 1px solid var(--study-border, #b98b52);
		padding-bottom: 12px;
	}
	.controls {
		display: flex;
		gap: 16px;
		align-items: end;
		flex-wrap: wrap;
		margin-top: 16px;
	}
	.controls input {
		max-width: 110px;
	}
	.picker {
		border: 2px solid #b98b52;
		padding: 12px;
		margin: 16px 0;
		background: #fff5df;
	}
	.choices {
		max-height: 220px;
		overflow: auto;
		scrollbar-gutter: stable;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 6px;
		margin-top: 10px;
	}
	.note {
		font-size: 17px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (max-width: 640px) {
		.ingredient {
			grid-template-columns: 1fr 1fr;
		}
		.ingredient :global(button:first-child) {
			grid-column: 1/-1;
		}
	}
</style>
