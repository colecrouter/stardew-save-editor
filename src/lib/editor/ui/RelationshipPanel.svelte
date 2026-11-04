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
	import VillagerPortrait from "./VillagerPortrait.svelte";
	import RelationshipHearts from "./RelationshipHearts.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
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
	<div>
		<h1>Relationships</h1>
		<p class="intro">Friendship, familiar faces and gifts for the week.</p>
	</div>

	<FarmerSelector field={farmerField} />
</div>

{#if domain?.supported}
	<div class="toolbar">
		<p>
			{domain.relationships.filter((row) => row.present).length} saved relationships
		</p>

		<div class="search">
			<StudyField label="Search villagers">
				{#snippet children(attributes)}
					<input
						{...attributes}
						class="study-input"
						type="search"
						bind:value={search}
					/>
				{/snippet}
			</StudyField>
		</div>
	</div>

	<p class="hint">
		Hearts change friendship points without changing relationship status.
	</p>

	{#if feedback?.farmerId === domain.farmerId}
		<StudyAlert
			title="Relationship change unavailable"
			tone="danger"
			live="assertive"
		>
			<p>{feedback.message}</p>
		</StudyAlert>
	{/if}

	{#key domain.farmerId}
		<div class="relationships">
			{#each shown as row (row.name)}
				<section
					class:missing={!row.present}
					aria-label={`${row.name} relationship`}
				>
					<VillagerPortrait name={row.name} />

					<div class="identity">
						<h2>{row.name}</h2>

						<RelationshipHearts
							points={row.points}
							maxHearts={row.maxHearts}
							present={row.present}
						/>

						{#if row.present}
							<p class="limit">Current limit: {row.maxHearts} hearts</p>
						{:else}
							<p class="missing-label">Not in this farmer's save</p>
						{/if}

						{#if Villagers.get(row.name)?.description}
							<details class="about">
								<summary>About {row.name}</summary>

								<p>{Villagers.get(row.name)?.description}</p>
							</details>
						{/if}
					</div>

					<div class="editor">
						<!-- Short visual labels keep the ledger compact. Native accessible
						     names still identify the villager, and field identity/operations
						     are unchanged. Missing rows explain their state once above. -->
						<div class="fields">
							<NumberField
								field={{
									...row.fields.hearts,
									label: "Hearts",
									reason: row.present ? row.fields.hearts.reason : undefined,
								}}
								aria-label={row.fields.hearts.label}
							/>
							<NumberField
								field={{
									...row.fields.points,
									label: "Points",
									reason: row.present ? row.fields.points.reason : undefined,
								}}
								aria-label={row.fields.points.label}
							/>
							<NumberField
								field={{
									...row.fields.gifts,
									label: "Gifts this week",
									reason: row.present ? row.fields.gifts.reason : undefined,
								}}
								aria-label={row.fields.gifts.label}
							/>
						</div>

						<div class="membership">
							{#if row.present}
								<ConfirmAction
									title={`Remove ${row.name}?`}
									description="This removes their saved relationship, including friendship points and gift history. You can Undo this change."
									label={`Remove ${row.name}`}
									disabled={!row.supported || pending}
									commit={row.remove}
								/>
							{:else}
								<StudyButton
									intent="constructive"
									disabled={pending}
									onclick={() => addVillager(row.name)}
								>
									Add {row.name}
								</StudyButton>
							{/if}
						</div>
					</div>
				</section>
			{:else}
				<StudyAlert title="No villagers match your search">
					<p>Try another name to find a relationship.</p>
				</StudyAlert>
			{/each}
		</div>
	{/key}

	<small class="attribution">
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
	<StudyAlert title="Relationships unavailable" tone="warning">
		<p>{domain?.reason ?? "No supported farmer is available."}</p>
	</StudyAlert>
{/if}

<style>
	.heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 24px;
	}
	h1 {
		font-size: 32px;
		margin: 0;
	}
	.intro {
		color: #694621;
		margin: 8px 0 0;
	}
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 20px;
		flex-wrap: wrap;
		border-bottom: 2px solid #b98b52;
		padding-bottom: 18px;
	}
	.toolbar p {
		margin: 0;
		color: #694621;
	}
	.search {
		width: 300px;
		max-width: 100%;
	}
	.hint {
		color: #694621;
		font-size: 17px;
		margin: 16px 0;
	}
	.relationships {
		display: grid;
		gap: 12px;
		margin: 20px 0;
	}
	section {
		display: grid;
		grid-template-columns: 68px minmax(200px, 1fr) minmax(300px, 1.5fr);
		gap: 20px;
		align-items: start;
		padding: 18px;
		border: 2px solid #b98b52;
		background: #fff1d2;
		min-width: 0;
	}
	section.missing {
		background: #f1ddb6;
	}
	.identity,
	.editor {
		min-width: 0;
	}
	h2 {
		font-size: 24px;
		margin: 0 0 10px;
		overflow-wrap: anywhere;
	}
	.limit,
	.missing-label {
		font-size: 16px;
		color: #795a36;
		margin: 8px 0 0;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}
	.missing .fields {
		opacity: 0.6;
	}
	.membership {
		display: flex;
		justify-content: end;
		margin-top: 12px;
	}
	.membership :global(button) {
		font-size: 17px;
	}
	.about {
		font-size: 16px;
		color: #694621;
		margin-top: 10px;
	}
	summary {
		cursor: pointer;
		min-height: 28px;
		padding: 4px 0;
	}
	summary:focus-visible {
		outline: 2px solid #754522;
		outline-offset: 2px;
	}
	.about p {
		line-height: 1.4;
		margin: 8px 0 0;
	}
	.attribution {
		font-size: 16px;
		color: #694621;
		line-height: 1.4;
	}
	@media (max-width: 1100px) {
		section {
			grid-template-columns: 68px minmax(0, 1fr);
		}
		.editor {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 480px) {
		h1 {
			font-size: 28px;
		}
		section {
			padding: 14px;
			gap: 14px;
		}
		.fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.fields > :global(:last-child) {
			grid-column: 1 / -1;
		}
		.search {
			width: 100%;
		}
	}
</style>
