<script lang="ts">
	import { stringSimilarity } from "string-similarity-js";
	import { ingredientChoices, ingredientObject } from "$lib/bundleIngredients";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import BundleItemSprite from "./BundleItemSprite.svelte";

	interface Props {
		/** What the item is picked for */
		label: string;
		/** Called with the picked item's ID */
		onsubmit: (id: string) => void;
	}

	let { label, onsubmit }: Props = $props();
	let filter = $state("");

	// Like the item editor's ItemSelect, but only what a bundle can ask for, by ID
	let values = $derived(
		ingredientChoices
			.filter((choice) =>
				choice.name.toLowerCase().includes(filter.toLowerCase()),
			)
			.toSorted(
				(a, b) =>
					stringSimilarity(filter, b.name) - stringSimilarity(filter, a.name),
			)
			.slice(0, 50),
	);
</script>

<div class="picker" data-testid="bundle-item-select">
	<UiInput
		type="text"
		placeholder="Type an item name"
		aria-label={label}
		data-testid="bundle-item-search"
		bind:value={filter}
	/>
	<UiContainerSmall>
		<div class="list">
			{#each values as choice (choice.id)}
				{@const sprite = ingredientObject(choice.id)?._key}
				<button
					type="button"
					class="choice"
					data-testid="bundle-item-choice"
					data-item-id={choice.id}
					onclick={() => onsubmit(choice.id)}
				>
					<div class="icon">
						{#if sprite}<BundleItemSprite itemKey={sprite} />{/if}
					</div>
					<div class="name">{choice.name}</div>
				</button>
			{:else}
				<div class="choice">
					<div class="name">No items found</div>
				</div>
			{/each}
		</div>
	</UiContainerSmall>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 4px 0;
	}

	.list {
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 200px;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.choice {
		all: unset;
		width: 100%;
		min-height: 32px;
		flex-shrink: 0;
		display: flex;
		gap: 0.5rem;
		cursor: pointer;
		align-items: center;
		overflow-x: hidden;
	}

	.choice:focus,
	.choice:hover {
		backdrop-filter: brightness(0.8);
	}

	.icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon :global(*) {
		pointer-events: none;
	}
</style>
