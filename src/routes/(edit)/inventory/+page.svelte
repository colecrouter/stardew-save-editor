<script lang="ts">
import { type DragDropState, draggable, droppable } from "@thisux/sveltednd";
import type { ParentIndex } from "$lib/ItemParentIndex";
import { Item, ValidSlotForItem } from "$lib/proxies/Item.svelte";
import { getSaveManager } from "$lib/SaveManager.svelte";
import { getToastManager, Toast } from "$lib/ToastManager.svelte";
import UiContainer from "$lib/ui/UIContainer.svelte";
import CharacterView from "./CharacterEquipment.svelte";
import ItemSlot from "./ItemSlot.svelte";
import ItemSprite from "./ItemSprite.svelte";
import ItemView from "./ItemView.svelte";

const toastManager = getToastManager();
const save = getSaveManager().save;
if (!save) throw new Error("No save data found");
let selectedIndex: ParentIndex = $state(0);
let selectedItem = $derived(save.player.inventory.get(selectedIndex));
let gridSlots = $derived<{ index: number; item: Item | undefined }[]>(
	Array.from({ length: save.player.inventory.slotCount }, (_, i) => ({
		index: i,
		item: save.player.inventory.get(i) as Item | undefined,
	})),
);

function handleDrop(state: DragDropState) {
	if (!save) return;
	const { sourceContainer, targetContainer } = state;

	const sourceIndex = Number(sourceContainer);
	const targetIndex = Number(targetContainer);
	const currentItem = save.player.inventory.get(sourceIndex);
	const swappingItem = save.player.inventory.get(targetIndex);

	// Not gonna bother checking slot validity here
	// Armor slots don't support drag and drop currently

	if (targetContainer && sourceContainer) {
		save.player.inventory.set(sourceIndex, swappingItem);
		save.player.inventory.set(targetIndex, currentItem);
	}

	selectedIndex = targetIndex;
}

function handleClick(index: ParentIndex) {
	if (!save) return;
	selectedIndex = index;
}

const slotNames = {
	leftRing: "Ring",
	rightRing: "Ring",
	boots: "Boots",
	hat: "Hat",
	shirtItem: "Shirt",
	pantsItem: "Pants",
	trinketItem: "Trinket",
} satisfies Record<Exclude<ParentIndex, number>, string>;

// Check if selected item matches the slot type
const testSlotValid = (item: Item | undefined, index: ParentIndex) => {
	if (!item) return true; // Empty is always valid
	const isValid = ValidSlotForItem(item, index);
	if (isValid) return true;
	if (typeof index === "number")
		throw new Error("number slot cannot be invalid");

	// Generate warning message
	toastManager.add(
		new Toast(
			`${item.info?.name} cannot be equipped in the ${slotNames[index]} slot!`,
			"failure",
		),
	);

	return false;
};

const createItem = (item: string) => {
	try {
		if (item === "") {
			return toastManager.add(
				new Toast("You must enter an item name first", "failure"),
			);
		}
		const newItem = Item.fromName(item);

		// Check if the item can go in the selected slot
		const isValid = testSlotValid(newItem, selectedIndex);
		if (!isValid) return;

		// Set the new item in the inventory
		save.player.inventory.set(selectedIndex, newItem);
	} catch (e) {
		toastManager.add(new Toast("Failed to create item", "failure"));
		throw e;
	}
};

const deleteItem = () => {
	if (!save) return;
	save.player.inventory.delete(selectedIndex);
};
</script>

{#if save.player}
	<!-- Inventory view -->
	<UiContainer>
		<div class="item-grid">
			{#each gridSlots as { index, item }}
				<div
					use:droppable={{
						container: index.toString(),
						callbacks: {
							onDrop: handleDrop,
						},
					}}
					data-testid={`slot-${index}`}
				>
					<ItemSlot
						data-testid={`item-${index}`}
						active={index === selectedIndex}
						onclick={() => handleClick(index)}
					>
						<div
							use:draggable={{
								container: index.toString(),
								dragData: "asd",
							}}
							data-testid={`draggable-${index}`}
						>
							<div class="item">
								<ItemSprite {item} />
							</div>
						</div>
					</ItemSlot>
				</div>
			{/each}
		</div>
	</UiContainer>

	<!-- Character View -->
	<UiContainer>
		{#if save.player}
			<CharacterView player={save.player} bind:selectedIndex />
		{/if}
	</UiContainer>

	<!-- Item view -->
	<UiContainer>
		<ItemView {selectedItem} {selectedIndex} {createItem} {deleteItem} />
	</UiContainer>
{/if}

<style>
	.item-grid {
		display: grid;
		grid-template-columns: repeat(12, min-content);
		grid-template-rows: 48px auto auto;
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
