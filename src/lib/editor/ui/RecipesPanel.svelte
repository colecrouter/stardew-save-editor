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
	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.characters ?? [],
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
	<h1>Recipes</h1>
	<FarmerSelector field={farmerField} />
</div>
<div class="categories" role="group" aria-label="Recipe category">
	<button
		type="button"
		aria-pressed={kind === "cooking"}
		onclick={() => chooseKind("cooking")}
	>
		Cooking
	</button>
	<button
		type="button"
		aria-pressed={kind === "crafting"}
		onclick={() => chooseKind("crafting")}
	>
		Crafting
	</button>
</div>
<p class="intro">
	{#if kind === "cooking"}
		Learn or forget recipes separately from the number of dishes cooked.
		Forgetting a recipe keeps your cooking progress. A zero count still counts
		as cooked until you reset its recorded entry.
	{:else}
		Crafted counts record items produced. Forgetting a recipe also clears its
		crafted count; Undo restores both.
	{/if}
	Changes update immediately. Use Undo to revert.
</p>
<div class="toolbar">
	<label>
		Search recipes <input type="search" bind:value={search} />
	</label>
	<label>
		Show recipes
		<select bind:value={filter}>
			<option value="all">All recipes</option>
			<option value="known">Known recipes</option>
			<option value="unknown">Unknown recipes</option>
		</select>
	</label>
	<span role="status">{rows.length} recipes</span>
</div>
{#if feedback?.target === targetKey}
	<p role="alert">{feedback.message}</p>
{/if}
{#if domain?.supported}
	{#key targetKey}
		<div class="recipes">
			{#each shown as row (row.name)}
				{@const presentation = recipePresentation(row.outputName)}
				<section aria-label={`${row.name} recipe`}>
					<div class="recipe-summary">
						<RecipeVisual sprite={presentation.sprite} />
						<div>
							<h2>{row.name}</h2>
							<span class="known">{row.known ? "Known" : "Not learned"}</span>
							{#if kind === "cooking" && row.hasCookedEntry}
								<span class="recorded">Recorded as cooked</span>
							{/if}
							{#if presentation.description}
								<p class="description">
									{presentation.description}
								</p>
							{/if}
						</div>
					</div>
					<div class="recipe-controls">
						<NumberField field={row.fields.count} />
						<div class="actions">
							{#if row.known && kind === "crafting" && (row.count ?? 0) > 0}
								<ConfirmAction
									title={`Forget ${row.name}?`}
									description="This also clears the crafted count. Undo can restore the recipe and its count."
									label={`Forget ${row.name}`}
									disabled={!row.supported || !!pending}
									commit={() => row.setKnown(false)}
								/>
							{:else}
								<button
									type="button"
									disabled={!row.supported || !!pending}
									onclick={() =>
										void perform(row.name, () => row.setKnown(!row.known))}
								>
									{row.known ? "Forget" : "Learn"}
									{row.name}
								</button>
							{/if}
							{#if kind === "cooking"}
								<ConfirmAction
									title={`Reset ${row.name} cooking progress?`}
									description="Clear the recorded cooking entry. The game counts an existing entry as cooked even when its count is zero. Undo can restore it."
									label={`Reset ${row.name} count`}
									disabled={!row.countSupported ||
										!row.hasCookedEntry ||
										!!pending}
									commit={row.reset}
								/>
							{:else}
								<button
									type="button"
									disabled={!row.countSupported || !row.count || !!pending}
									onclick={() => void perform(row.name, row.reset)}
								>
									Reset {row.name} count
								</button>
							{/if}
						</div>
					</div>
					{#if row.reason}
						<p class="reason">{row.reason}</p>
					{/if}
				</section>
			{:else}
				<p>No recipes match your search.</p>
			{/each}
		</div>
		{#if rows.length > shown.length}
			<button type="button" onclick={() => (limit += 24)}>
				Show more recipes ({rows.length - shown.length} remaining)
			</button>
		{/if}
	{/key}
{:else}
	<p role="status">{domain?.reason ?? "No supported farmer is available."}</p>
{/if}

<style>
	.heading,
	.toolbar {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
	}
	.categories {
		display: flex;
		gap: 8px;
		margin: 20px 0 12px;
	}
	button,
	input,
	select {
		font: inherit;
	}
	button {
		min-height: 40px;
		padding: 6px 12px;
		cursor: pointer;
		color: #351b0e;
		border: 2px solid #a8743a;
		background: #fff0cc;
	}
	button[aria-pressed="true"] {
		background: #754322;
		color: #fff1cf;
		border-color: #512a15;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	label {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	input,
	select {
		min-height: 40px;
		max-width: 100%;
		border: 2px solid #bb925e;
		background: #fff2d3;
		color: #351b0e;
		padding: 5px 8px;
		box-sizing: border-box;
	}
	.toolbar input {
		width: 280px;
	}
	.toolbar [role="status"] {
		font-size: 17px;
		color: #694621;
	}
	.intro {
		font-size: 18px;
		line-height: 1.4;
	}
	.recipes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 24px;
		margin-top: 24px;
	}
	section {
		border-top: 1px solid #bb925e;
		padding: 20px 0;
		min-width: 0;
	}
	.recipe-summary {
		display: flex;
		gap: 12px;
		align-items: start;
	}
	h2 {
		font-size: 23px;
		margin: 0 0 4px;
		overflow-wrap: anywhere;
	}
	.recorded {
		display: block;
		font-size: 16px;
		color: #246f44;
	}
	.known {
		font-size: 17px;
		color: #694621;
	}
	.description,
	.reason {
		font-size: 17px;
		line-height: 1.4;
		color: #694621;
		margin: 8px 0;
	}
	.recipe-controls {
		display: grid;
		gap: 12px;
		margin-top: 16px;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}
	.actions button {
		font-size: 17px;
	}
	[role="alert"] {
		color: #8a1c19;
	}
	@media (max-width: 1050px) {
		.recipes {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 480px) {
		.toolbar {
			align-items: stretch;
		}
		.toolbar label {
			width: 100%;
		}
		.toolbar input {
			width: 100%;
		}
		.actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
