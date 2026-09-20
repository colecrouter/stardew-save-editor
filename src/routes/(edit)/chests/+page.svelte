<script lang="ts">
	import { Item } from "$lib/proxies/Item.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import ItemSlot from "../inventory/ItemSlot.svelte";
	import ItemSprite from "../inventory/ItemSprite.svelte";
	import ItemView from "../inventory/ItemView.svelte";

	const toastManager = getToastManager();
	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");

	let selectedChestIndex = $state(0);
	let selectedIndex = $state(0);
	let selectedChest = $derived(save.chests[selectedChestIndex]);
	let selectedItem = $derived(selectedChest?.inventory.get(selectedIndex));
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

	const deleteItem = () => selectedChest?.inventory.delete(selectedIndex);
</script>

<h1>Chests</h1>

{#if save.chests.length === 0}
	<UiContainer>
		<p>No editable chests were found in this save.</p>
	</UiContainer>
{:else if selectedChest}
	<UiContainer>
		<label class="picker">
			<span>Container</span>
			<select
				bind:value={selectedChestIndex}
				onchange={() => (selectedIndex = 0)}
			>
				{#each save.chests as chest, index}
					<option value={index}>{chest.metadata.label}</option>
				{/each}
			</select>
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
					active={index === selectedIndex}
					data-testid={`chest-item-${index}`}
					onclick={() => (selectedIndex = index)}
				>
					<div class="item">
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
	.picker {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.picker select {
		width: 100%;
		padding: 6px;
	}

	.item-grid {
		display: grid;
		grid-template-columns: repeat(12, min-content);
		grid-auto-rows: 48px;
	}

	.item {
		position: relative;
		transition: transform 0.1s;
		cursor: pointer;
	}

	.item:hover {
		transform: scale(1.2);
		transform-origin: center;
	}
</style>
