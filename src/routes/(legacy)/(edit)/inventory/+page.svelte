<script lang="ts">
	import { type DragDropState, draggable, droppable } from "@thisux/sveltednd";
	import { sortSlots } from "$lib/chestMoves";
	import type { ParentIndex } from "$lib/ItemParentIndex";
	import { Dispose } from "$lib/proxies";
	import { Item, ValidSlotForItem } from "$lib/proxies/Item.svelte";
	import type { ItemProxy } from "$lib/proxies/items";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import SortButton from "$lib/ui/SortButton.svelte";
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
	let gridSlots = $derived(
		Array.from({ length: save.player.inventory.slotCount }, (_, i) => ({
			index: i,
			item: save.player.inventory.get(i),
		})),
	);

	function handleDrop(state: DragDropState) {
		if (!save) return;
		const { sourceContainer, targetContainer } = state;

		const sourceIndex = Number(sourceContainer);
		const targetIndex = Number(targetContainer);

		// Not gonna bother checking slot validity here
		// Armor slots don't support drag and drop currently

		if (targetContainer && sourceContainer) {
			save.player.inventory.swap(sourceIndex, targetIndex);
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
	const testSlotValid = (item: ItemProxy | undefined, index: ParentIndex) => {
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
			let adopted = false;
			try {
				if (!testSlotValid(newItem, selectedIndex)) return;
				save.player.inventory.set(selectedIndex, newItem);
				adopted = true;
			} finally {
				// Until insertion succeeds, this temporary item's root belongs here.
				if (!adopted) newItem[Dispose]?.();
			}
		} catch (e) {
			toastManager.add(new Toast("Failed to create item", "failure"));
			throw e;
		}
	};

	const deleteItem = () => {
		if (!save) return;
		save.player.inventory.delete(selectedIndex);
	};

	// Same as the game's Organize button on the inventory page
	const sortInventory = () => {
		sortSlots(save.player.inventory);
		toastManager.add(new Toast("Inventory sorted", "success"));
	};
</script>

{#if save.player}
	<div class="inventory-layout">
		<!-- Inventory view -->
		<UiContainer>
			<div class="title">
				<h3>Inventory</h3>
				<SortButton
					label="Sort inventory"
					onclick={sortInventory}
					data-testid="sort-inventory"
				/>
			</div>
			<div class="item-grid">
				{#each gridSlots as { index, item } (index)}
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
							{item}
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

		<section class="item-inspector" aria-label="Selected item">
			<!-- Item view -->
			<UiContainer>
				<ItemView {selectedItem} {selectedIndex} {createItem} {deleteItem} />
			</UiContainer>
		</section>
		<!-- Equipment stays available below the selected item on narrow screens. -->
		<div class="equipment">
			<UiContainer>
				{#if save.player}
					<CharacterView player={save.player} bind:selectedIndex />
				{/if}
			</UiContainer>
		</div>
	</div>
{/if}

<style>
	.inventory-layout {
		display: grid;
		grid-template-columns: minmax(440px, 1fr) minmax(320px, 420px);
		grid-template-rows: min-content 1fr;
		gap: 32px;
		align-items: start;
	}
	.equipment {
		grid-column: 1;
		min-width: 0;
	}
	.item-inspector {
		grid-column: 2;
		grid-row: 1 / span 2;
		min-width: 0;
		padding-left: 24px;
		border-left: 1px solid #be8d4d;
	}
	@media (max-width: 1200px) {
		.inventory-layout {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
		}
		.item-inspector {
			grid-column: 1;
			grid-row: 2;
			border-left: 0;
			border-top: 1px solid #be8d4d;
			padding: 24px 0 0;
		}
	}

	.title {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

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
	@media (max-width: 600px) {
		.item-grid {
			grid-template-columns: repeat(6, min-content);
			grid-template-rows: none;
			gap: 4px;
		}
	}
</style>
