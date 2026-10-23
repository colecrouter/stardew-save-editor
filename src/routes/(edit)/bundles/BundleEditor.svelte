<script lang="ts">
	import {
		BUNDLE_QUALITIES,
		canHaveQuality,
		ingredientName,
		ingredientObject,
		MAX_BUNDLE_ITEMS,
		MAX_GOLD,
		MAX_INGREDIENT_STACK,
	} from "$lib/bundleIngredients";
	import type { Bundle } from "$lib/proxies/CommunityBundles.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import BundleItemSelect from "./BundleItemSelect.svelte";
	import BundleItemSprite from "./BundleItemSprite.svelte";

	interface Props {
		bundle: Bundle;
	}

	let { bundle }: Props = $props();

	/** The item being swapped for another, or "new" while adding one */
	let picking = $state<number | "new">();
	/** Why the last change couldn't be made */
	let problem = $state<string>();

	/** Make a change, or say why it can't be made */
	function attempt(apply: () => void) {
		try {
			apply();
			problem = undefined;
		} catch (error) {
			if (!(error instanceof Error)) throw error;
			problem = error.message;
		}
	}

	/** Like attempt, for inputs, which also show the error on themselves */
	function change(apply: () => void) {
		attempt(apply);
		if (problem) throw new Error(problem);
	}

	function pick(id: string) {
		const target = picking;
		picking = undefined;
		attempt(() => {
			if (target === "new") bundle.addItem(id);
			else if (target !== undefined) {
				const item = bundle.requiredItems[target];
				if (item) item.itemID = id;
			}
		});
	}

	/** The qualities a slot can ask for: only normal if its item never has a quality */
	const qualities = (id: string, current: number) => {
		const options = canHaveQuality(id) ? [...BUNDLE_QUALITIES.keys()] : [0];
		if (!options.includes(current)) options.push(current);
		return options;
	};

	let full = $derived(bundle.requiredItems.length >= MAX_BUNDLE_ITEMS);
</script>

<div class="editor" data-testid="bundle-editor">
	{#if bundle.isVault}
		<label class="field">
			Price
			<UiInput
				type="number"
				min={1}
				max={MAX_GOLD}
				data-testid="bundle-edit-price"
				bind:value={() => bundle.price,
				(gold) => change(() => (bundle.price = Number(gold)))}
			/>
			g
		</label>
		<p class="note">
			Vault bundles are bought with gold, so only the price can change.
		</p>
	{:else}
		<ul class="rows">
			{#each bundle.requiredItems as item, i (item)}
				{@const [id] = item.requirement}
				{@const name = ingredientName(id)}
				{@const sprite = ingredientObject(id)?._key}
				{@const options = qualities(id, item.quality)}
				<li
					class="row"
					class:picking={picking === i}
					data-testid="bundle-edit-row"
				>
					<button
						type="button"
						class="pick"
						data-testid="bundle-edit-swap"
						aria-label={`Change ${name}`}
						title="Change item"
						onclick={() => (picking = picking === i ? undefined : i)}
					>
						<span class="icon">
							{#if sprite}<BundleItemSprite itemKey={sprite} />{:else}?{/if}
						</span>
						<span class="name" data-testid="bundle-edit-name">{name}</span>
						<span class="pencil" aria-hidden="true">✎</span>
					</button>
					<label class="field">
						×
						<UiInput
							type="number"
							min={1}
							max={MAX_INGREDIENT_STACK}
							aria-label={`How many ${name}`}
							data-testid="bundle-edit-quantity"
							bind:value={() => item.quantity,
							(amount) => change(() => (item.quantity = Number(amount)))}
						/>
					</label>
					<div class="quality">
						<UiSelect
							aria-label={`Quality of ${name}`}
							data-testid="bundle-edit-quality"
							disabled={options.length < 2}
							value={item.quality}
							onchange={(e) =>
								attempt(() => (item.quality = Number(e.currentTarget.value)))}
						>
							{#each options as quality (quality)}
								<option value={quality}
									>{BUNDLE_QUALITIES.get(quality) ??
										`Quality ${quality}`}</option
								>
							{/each}
						</UiSelect>
					</div>
					<button
						type="button"
						class="small"
						data-testid="bundle-edit-remove"
						aria-label={`Remove ${name}`}
						onclick={() => {
							picking = undefined;
							attempt(() => bundle.removeItem(i));
						}}
					>
						✕
					</button>
				</li>
			{/each}
		</ul>

		<div class="actions">
			<label class="field">
				Items needed
				<UiInput
					type="number"
					min={1}
					max={bundle.requiredItems.length}
					data-testid="bundle-edit-needed"
					bind:value={() => bundle.requiredItemCount,
					(count) => change(() => bundle.setRequiredItemCount(Number(count)))}
				/>
				of {bundle.requiredItems.length}
			</label>
			<button
				type="button"
				class="small"
				data-testid="bundle-edit-add"
				disabled={full}
				onclick={() => (picking = picking === "new" ? undefined : "new")}
			>
				Add item
			</button>
		</div>
		{#if full}
			<p class="note">
				The bundle menu has room for {MAX_BUNDLE_ITEMS} items at most.
			</p>
		{/if}

		{#if picking !== undefined}
			{@const replacing =
				picking === "new" ? undefined : bundle.requiredItems[picking]}
			<BundleItemSelect
				label={replacing
					? `Item to ask for instead of ${ingredientName(replacing.requirement[0])}`
					: "Item to add"}
				onsubmit={pick}
			/>
			<button
				type="button"
				class="small"
				data-testid="bundle-edit-cancel"
				onclick={() => (picking = undefined)}
			>
				Cancel
			</button>
		{/if}
	{/if}

	{#if problem}
		<p class="problem" role="alert" data-testid="bundle-edit-problem">
			{problem}
		</p>
	{/if}
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 6px 0;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr auto 6.5em auto;
		align-items: center;
		gap: 6px;
		padding: 2px 4px;
		border-bottom: 1px solid #0003;
	}

	.row.picking {
		background: #fff6;
		border-radius: 4px;
	}

	.pick {
		all: unset;
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		cursor: pointer;
		border-radius: 4px;
	}

	.pick:hover,
	.pick:focus-visible {
		backdrop-filter: brightness(0.85);
	}

	.pencil {
		opacity: 0.6;
	}

	.icon {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.field {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}

	.small {
		font: inherit;
		font-size: 0.85em;
		padding: 2px 8px;
		cursor: pointer;
		border: solid 2px #9c613b;
		border-bottom-color: #6f3b31;
		border-right-color: #6f3b31;
		border-radius: 4px;
		background-color: #f9bb65;
		color: inherit;
	}

	.small:hover {
		filter: brightness(0.9);
	}

	.small:disabled {
		cursor: default;
		filter: brightness(0.75);
	}

	.note {
		margin: 0;
		font-size: 0.85em;
		opacity: 0.8;
	}

	.problem {
		margin: 0;
		padding: 4px 8px;
		background-color: rgba(255, 0, 0, 0.25);
		border-left: solid 4px rgba(255, 0, 0, 0.7);
	}
</style>
