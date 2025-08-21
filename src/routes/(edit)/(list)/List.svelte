<script lang="ts">
	import { Item } from "$lib/proxies/Item.svelte";
	import type { Recipes } from "$lib/proxies/Recipes.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import ItemSprite from "../inventory/ItemSprite.svelte";
	import { recipeMapping } from "./mapping";

	interface Props {
		recipes: Recipes<"cookingRecipes" | "craftingRecipes">;
	}

	let { recipes = $bindable() }: Props = $props();

	let filter = $state("");
	let regex = $derived(new RegExp(filter, "i"));
</script>

<UiContainer>
	<h3>Crafting Recipes</h3>

	<div class="search">
		<UiInput type="text" placeholder="Search..." bind:value={filter} />
	</div>

	<div class="wrapper">
		{#each recipes as [key, value]}
			{#if regex.test(key)}
				<label class="entry">
					<div class="key">
						<div class="img">
							<ItemSprite item={Item.fromName(recipeMapping.get(key) ?? key)} />
						</div>
						{key}
					</div>

					<div class="input-wrapper">
						<UiCheckbox
							data-testid="recipe-{key.toLowerCase()}"
							checked={value !== null}
							onchange={() => {
								// Toggle the unlock status by changing between `null` and `number` (0 is default)
								if (value === null) {
									console.log("Unlocking recipe:", key);
									recipes.set(key, 0);
								} else {
									console.log("Locking recipe:", key);
									recipes.set(key, null);
								}
							}}
						/>
						<UiInput
							type="number"
							value={value === null ? "" : value}
							min="0"
							max={Number.MAX_SAFE_INTEGER}
							step="1"
							disabled={value === null}
							onchange={(e) => {
								const value = (e.target as HTMLInputElement).value;
								// If unlocked, ensure the value is a number (fallback to 0)
								if (value !== null) {
									recipes.set(key, +value || 0);
								} else {
									// If not unlocked, set to null
									recipes.set(key, null);
								}
							}}
						/>
					</div>
				</label>
			{/if}
		{/each}
	</div>
</UiContainer>

<style>
	.search :global(input) {
		width: 100%;
		margin: 4px;
		margin-bottom: 8px;
		font-size: large;
	}

	.wrapper {
		display: flex;
		flex-direction: column;
		height: 20rem;
		overflow-y: scroll;
	}

	.entry {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: #5b2b2a 1px solid;
		padding-left: 0.5em;
		margin: 2px 0;
	}

	.key {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-bottom: 2px;
	}

	.img {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.input-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
	}
</style>
