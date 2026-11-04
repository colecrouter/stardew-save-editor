<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import type { CommandResult } from "../command-result.ts";
	import { createRecipeDomain } from "../recipe-domain.ts";
	import { recipePresentation } from "../recipe-presentation.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import ConfirmAction from "./ConfirmAction.svelte";
	import RecipeVisual from "./RecipeVisual.svelte";
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
		view.current?.recipes.find((owner) => owner.farmerId === selection.current),
	);
	let kind = $state<"cooking" | "crafting">("cooking");
	let search = $state("");
	let filter = $state("all");
	let limit = $state(24);
	const domain = $derived(
		selected ? createRecipeDomain(selected, kind, model) : undefined,
	);
	// Keep catalog order stable while editing counts. Sorting by progress would
	// move the active input after every valid keystroke and lose its focus.
	const rows = $derived(
		(domain?.rows ?? []).filter(
			(row) =>
				row.name.toLowerCase().includes(search.trim().toLowerCase()) &&
				(filter === "all" || (filter === "known" ? row.known : !row.known)),
		),
	);
	// Limit mounted field controllers and sprite nodes; search still covers the
	// complete catalog and users can reveal additional matches without changing data.
	const shown = $derived(rows.slice(0, limit));
	const targetKey = $derived(`${selection.current}:${kind}`);
	let pending = $state<string>();
	let feedback = $state<{ target: string; message: string }>();
	function chooseKind(next: "cooking" | "crafting") {
		// A category switch ends the current Undo gesture before replacing its fields.
		void model.edits.endActive();
		kind = next;
		limit = 24;
	}
	async function perform(
		name: string,
		action: () => Promise<CommandResult<unknown, { message: string }>>,
	) {
		const target = targetKey;
		const key = `${target}:${name}`;
		if (pending) return;
		pending = key;
		feedback = undefined;
		try {
			const result = await action();
			// Commands retain their original farmer/category. A late rejection must not
			// appear beside a different farmer's recipe after navigation or selection.
			if (result && Result.isFailure(result) && targetKey === target)
				feedback = { target, message: result.failure.message };
		} finally {
			if (pending === key) pending = undefined;
		}
	}
</script>

<div class="heading">
	<div>
		<h1>Recipes</h1>
		<p class="subtitle">Your cookbook & crafting collection</p>
	</div>
	<FarmerSelector field={farmerField} />
</div>
<div class="categories" role="group" aria-label="Recipe category">
	<StudyButton
		variant={kind === "cooking" ? "filled" : "plain"}
		aria-pressed={kind === "cooking"}
		onclick={() => chooseKind("cooking")}
	>
		Cooking
	</StudyButton>
	<StudyButton
		variant={kind === "crafting" ? "filled" : "plain"}
		aria-pressed={kind === "crafting"}
		onclick={() => chooseKind("crafting")}
	>
		Crafting
	</StudyButton>
</div>
<details class="progress-help">
	<summary>How recipe progress works</summary>
	<p class="intro">
		{#if kind === "cooking"}
			Learn or forget recipes separately from the number of dishes cooked.
			Forgetting a recipe keeps your cooking progress. A zero count still counts
			as cooked until you reset its recorded entry.
		{:else}
			Crafted counts record items produced. Forgetting a recipe also clears its
			crafted count; Undo restores both.
		{/if}
	</p>
</details>
<div class="toolbar">
	<StudyField label="Search recipes">
		{#snippet children(attributes)}
			<input
				{...attributes}
				type="search"
				class="study-input"
				bind:value={search}
			/>
		{/snippet}
	</StudyField>
	<StudyField label="Show recipes">
		{#snippet children(attributes)}
			<select {...attributes} class="study-input" bind:value={filter}>
				<option value="all">All recipes</option>
				<option value="known">Known recipes</option>
				<option value="unknown">Unknown recipes</option>
			</select>
		{/snippet}
	</StudyField>
	<span role="status">{rows.length} recipes</span>
</div>
{#if feedback?.target === targetKey}
	<StudyAlert tone="danger" title="Recipe change unavailable" live="assertive">
		<p>{feedback.message}</p>
	</StudyAlert>
{/if}
{#if domain?.supported}
	{#key targetKey}
		<div class="recipes">
			{#each shown as row (row.name)}
				{@const presentation = recipePresentation(row.outputName)}
				<section class:unlearned={!row.known} aria-label={`${row.name} recipe`}>
					<div class="recipe-summary">
						<RecipeVisual sprite={presentation.sprite} />
						<div>
							<h2>{row.name}</h2>
							<span class="known">{row.known ? "Known" : "Not learned"}</span>
							{#if kind === "cooking" && row.hasCookedEntry}
								<span class="recorded">Recorded as cooked</span>
							{/if}
							{#if presentation.description}
								<details class="description">
									<summary>About this recipe</summary>
									<p>{presentation.description}</p>
								</details>
							{/if}
						</div>
					</div>
					<div class="recipe-controls">
						<!-- Presentation stays compact; the binding keeps its captured farmer,
 category and Undo gesture, including the full accessible recipe name. -->
						<NumberField
							field={{
								...row.fields.count,
								label: kind === "cooking" ? "Cooked" : "Crafted items",
							}}
							aria-label={row.fields.count.label}
						/>
						<div class="actions">
							{#if row.known && kind === "crafting" && (row.count ?? 0) > 0}
								<ConfirmAction
									title={`Forget ${row.name}?`}
									description="This also clears the crafted count. Undo can restore the recipe and its count."
									label={`Forget ${row.name}`}
									triggerLabel="Forget"
									disabled={!row.supported || !!pending}
									commit={() => row.setKnown(false)}
								/>
							{:else}
								<StudyButton
									aria-label={`${row.known ? "Forget" : "Learn"} ${row.name}`}
									disabled={!row.supported || !!pending}
									onclick={() =>
										void perform(row.name, () => row.setKnown(!row.known))}
								>
									{row.known ? "Forget" : "Learn"}
								</StudyButton>
							{/if}
							{#if kind === "cooking"}
								<ConfirmAction
									title={`Reset ${row.name} cooking progress?`}
									description="Clear the recorded cooking entry. The game counts an existing entry as cooked even when its count is zero. Undo can restore it."
									label={`Reset ${row.name} count`}
									triggerLabel="Reset"
									disabled={!row.countSupported ||
										!row.hasCookedEntry ||
										!!pending}
									commit={row.reset}
								/>
							{:else}
								<StudyButton
									aria-label={`Reset ${row.name} count`}
									disabled={!row.countSupported || !row.count || !!pending}
									onclick={() => void perform(row.name, row.reset)}
								>
									Reset
								</StudyButton>
							{/if}
						</div>
					</div>
					{#if row.reason}
						<p class="reason">{row.reason}</p>
					{/if}
				</section>
			{:else}
				<StudyAlert title="No recipes match your search">
					<p>Try another name or recipe filter.</p>
				</StudyAlert>
			{/each}
		</div>
		{#if rows.length > shown.length}
			<StudyButton onclick={() => (limit += 24)}>
				Show more recipes ({rows.length - shown.length} remaining)
			</StudyButton>
		{/if}
	{/key}
{:else}
	<StudyAlert title="Recipes unavailable" tone="warning">
		<p>{domain?.reason ?? "No supported farmer is available."}</p>
	</StudyAlert>
{/if}

<style>
	.heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
	}
	.subtitle {
		color: #694621;
		margin: 8px 0 0;
	}
	.categories {
		display: flex;
		gap: 8px;
		margin: 20px 0 12px;
	}
	.progress-help {
		color: #694621;
		font-size: 17px;
		margin-bottom: 16px;
	}
	summary {
		cursor: pointer;
		padding: 6px 0;
	}
	summary:focus-visible {
		outline: 2px solid #754522;
		outline-offset: 2px;
	}
	.intro {
		line-height: 1.4;
		max-width: 700px;
		margin: 6px 0;
	}
	.toolbar {
		display: grid;
		grid-template-columns: minmax(0, 300px) minmax(0, 220px) 1fr;
		gap: 16px;
		align-items: end;
	}
	.toolbar [role="status"] {
		font-size: 17px;
		color: #694621;
		padding-bottom: 10px;
		text-align: right;
	}
	/* Even-sized paper records form a compact book spread. Descriptions expand
    in place; catalog order and keyed rows keep active count inputs stable. */
	.recipes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin: 20px 0;
		align-items: start;
	}
	section {
		border: 2px solid #b98b52;
		background: #fff1d2;
		padding: 12px;
		min-width: 0;
	}
	section.unlearned {
		background: #f1ddb6;
	}
	.recipe-summary {
		display: flex;
		gap: 10px;
		align-items: start;
	}
	.recipe-summary > div {
		min-width: 0;
	}
	h2 {
		font-size: 21px;
		margin: 0 0 4px;
		overflow-wrap: anywhere;
	}
	.recorded {
		display: block;
		font-size: 16px;
		color: #246f44;
	}
	.known {
		font-size: 16px;
		color: #694621;
	}
	.description,
	.reason {
		font-size: 16px;
		line-height: 1.35;
		color: #694621;
		margin: 4px 0 0;
	}
	.description p {
		margin: 4px 0 0;
	}
	.recipe-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 12px;
		align-items: end;
		margin-top: 12px;
		border-top: 1px solid #d5b782;
		padding-top: 10px;
	}
	.actions {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
		justify-content: end;
	}
	.actions :global(button) {
		font-size: 16px;
	}
	@media (max-width: 1200px) {
		.recipe-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.actions {
			justify-content: start;
		}
	}
	@media (max-width: 700px) {
		.recipes {
			grid-template-columns: minmax(0, 1fr);
		}
		.toolbar {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.toolbar [role="status"] {
			grid-column: 1 / -1;
			padding: 0;
			text-align: left;
		}
	}
	@media (max-width: 480px) {
		h1 {
			font-size: 28px;
		}
		.toolbar {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
