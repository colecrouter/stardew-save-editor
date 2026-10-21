<script lang="ts">
	import { searchChests } from "$lib/proxies/Chest.svelte";
	import { Item } from "$lib/proxies/Item.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import ItemSlot from "../inventory/ItemSlot.svelte";
	import ItemSprite from "../inventory/ItemSprite.svelte";
	import ItemView from "../inventory/ItemView.svelte";

	const toastManager = getToastManager();
	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");

	let search = $state("");
	let searchResults = $derived(searchChests(save.chests, search));
	let showResults = $state(true);
	let searchBox: HTMLDivElement | undefined = $state();
	let selectedChestIndex = $state(0);
	let selectedIndex = $state(0);
	// Hovering a search result previews its chest without committing the selection
	let preview = $state<{ chestIndex: number; slotIndex: number } | null>(null);
	let viewChestIndex = $derived(preview?.chestIndex ?? selectedChestIndex);
	let viewIndex = $derived(preview?.slotIndex ?? selectedIndex);
	let selectedChest = $derived(save.chests[viewChestIndex]);
	let selectedItem = $derived(selectedChest?.inventory.get(viewIndex));
	let gridSlots = $derived(
		selectedChest
			? Array.from(
					{ length: selectedChest.inventory.slotCount },
					(_, index) => ({
						index,
						item: selectedChest?.inventory.get(index),
					}),
				)
			: [],
	);

	const createItem = (name: string) => {
		if (!selectedChest) return;
		try {
			if (!name) {
				toastManager.add(
					new Toast("You must enter an item name first", "failure"),
				);
				return;
			}
			selectedChest.inventory.set(selectedIndex, Item.fromName(name));
		} catch (error) {
			toastManager.add(new Toast("Failed to create item", "failure"));
			throw error;
		}
	};

	const selectResult = (chestIndex: number, slotIndex: number) => {
		selectedChestIndex = chestIndex;
		selectedIndex = slotIndex;
		preview = null;
		showResults = false;
	};

	const clearSearch = () => {
		search = "";
		preview = null;
		searchBox?.querySelector("input")?.focus();
	};

	const isMatch = (slotIndex: number) =>
		searchResults.some(
			(result) =>
				result.chestIndex === viewChestIndex && result.slotIndex === slotIndex,
		);

	const deleteItem = () => selectedChest?.inventory.delete(selectedIndex);
</script>

{#if save.chests.length === 0}
	<UiContainer>
		<p>No editable chests were found in this save.</p>
	</UiContainer>
{:else if selectedChest}
	<UiContainer>
		<h3>Chests</h3>
		<div class="search" bind:this={searchBox}>
			<UiInput
				type="text"
				placeholder="Search all chests..."
				data-testid="chest-search"
				bind:value={search}
				onfocus={() => (showResults = true)}
				oninput={() => (showResults = true)}
				onkeydown={(event) => {
					if (event.key === "Escape" && search) {
						event.preventDefault();
						clearSearch();
					}
				}}
			/>
			{#if search}
				<button
					class="clear"
					type="button"
					aria-label="Clear search"
					title="Clear search"
					data-testid="chest-search-clear"
					onclick={clearSearch}
				>
					&times;
				</button>
			{/if}
		</div>
		{#if search.trim() && showResults}
			{#if searchResults.length === 0}
				<small>No items found.</small>
			{:else}
				<small>
					{searchResults.length}
					{searchResults.length === 1 ? "match" : "matches"}
				</small>
				<div
					class="results"
					role="presentation"
					onmouseleave={() => (preview = null)}
				>
					{#each searchResults as { chestIndex, slotIndex, chest, item }}
						<button
							class="result"
							class:active={chestIndex === viewChestIndex &&
								slotIndex === viewIndex}
							data-testid={`chest-search-result-${chestIndex}-${slotIndex}`}
							onmouseenter={() => (preview = { chestIndex, slotIndex })}
							onfocus={() => (preview = { chestIndex, slotIndex })}
							onblur={() => (preview = null)}
							onclick={() => selectResult(chestIndex, slotIndex)}
						>
							<div class="result-sprite">
								<ItemSprite {item} />
							</div>
							<span class="result-name"
								>{item.name} &times;{item.amount ?? item.stack}</span
							>
							<span class="result-chest">{chest.metadata.label}</span>
						</button>
					{/each}
				</div>
			{/if}
		{/if}
		<label class="picker">
			<span hidden>Container</span>
			<UiSelect
				bind:value={selectedChestIndex}
				onchange={() => (selectedIndex = 0)}
			>
				{#each save.chests as chest, index}
					<option value={index}>{chest.metadata.label}</option>
				{/each}
			</UiSelect>
		</label>
		<small>
			{selectedChest.inventory.usedSlots} / {selectedChest.inventory.slotCount}
			occupied slots
		</small>
	</UiContainer>

	<UiContainer>
		<div class="item-grid">
			{#each gridSlots as { index, item }}
				<ItemSlot
					active={index === viewIndex}
					data-testid={`chest-item-${index}`}
					onclick={() => (selectedIndex = index)}
				>
					<div
						class="item"
						class:dimmed={showResults &&
							search.trim() &&
							item &&
							!isMatch(index)}
					>
						<ItemSprite {item} />
					</div>
				</ItemSlot>
			{/each}
		</div>
	</UiContainer>

	<UiContainer>
		<ItemView {selectedItem} {selectedIndex} {createItem} {deleteItem} />
	</UiContainer>
{/if}

<style>
	.search {
		position: relative;
		margin-bottom: 4px;
	}

	.search :global(input) {
		width: 100%;
		box-sizing: border-box;
		padding-right: 28px;
		font-size: large;
	}

	.clear {
		all: unset;
		position: absolute;
		top: 50%;
		right: 6px;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		line-height: 20px;
		text-align: center;
		font-size: 22px;
		font-weight: bold;
		color: #6f3b31;
		border-radius: 4px;
		cursor: pointer;
	}

	.clear:hover,
	.clear:focus-visible {
		background-color: rgba(0, 0, 0, 0.12);
	}

	.results {
		display: flex;
		flex-direction: column;
		max-height: 12rem;
		overflow-y: auto;
		margin-top: 4px;
		margin-bottom: 8px;
	}

	.result {
		all: unset;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 4px;
		border-bottom: #5b2b2a 1px solid;
		cursor: pointer;
	}

	.result:hover,
	.result:focus-visible,
	.result.active {
		background-color: rgba(255, 255, 255, 0.4);
	}

	.result-sprite {
		position: relative;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.result-name {
		flex: 1;
	}

	.result-chest {
		font-size: small;
		opacity: 0.8;
	}

	/* Fade out quickly while searching; fade back in slowly once results close */
	.item.dimmed {
		opacity: 0.3;
		transition:
			transform 0.1s,
			opacity 0.15s;
	}

	.picker {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.item-grid {
		display: grid;
		grid-template-columns: repeat(12, min-content);
		grid-auto-rows: 48px;
	}

	.item {
		position: relative;
		transition:
			transform 0.1s,
			opacity 3s linear;
		cursor: pointer;
	}

	.item:hover {
		transform: scale(1.2);
		transform-origin: center;
	}
</style>
