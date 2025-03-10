<script lang="ts">
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import { Toast, getToastManager } from "$lib/ToastManager.svelte";
    import { Item } from "$lib/proxies/Item";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import {
        type DragDropState,
        draggable,
        droppable,
    } from "@thisux/sveltednd";
    import CharacterView from "./CharacterEquipment.svelte";
    import ItemSlot from "./ItemSlot.svelte";
    import ItemSprite from "./ItemSprite.svelte";
    import ItemView from "./ItemView.svelte";

    const toastManager = getToastManager();
    const save = getSaveManager().save;
    if (!save) throw new Error("No save data found");
    let selectedIndex: ParentIndex = $state(0);
    let selectedItem = $derived(save.player.inventory.getItem(selectedIndex));

    function handleDrop(state: DragDropState) {
        if (!save) return;
        const { sourceContainer, targetContainer } = state;

        const sourceIndex = Number(sourceContainer);
        const targetIndex = Number(targetContainer);
        const currentItem = save.player.inventory.getItem(sourceIndex);
        const swappingItem = save.player.inventory.getItem(targetIndex);

        if (targetContainer && sourceContainer) {
            save.player.inventory.setItem(sourceIndex, swappingItem);
            save.player.inventory.setItem(targetIndex, currentItem);
        }

        selectedIndex = targetIndex;
    }

    function handleClick(index: number) {
        if (!save) return;
        selectedIndex = index;
    }
</script>

{#if save.player}
    <!-- Inventory view -->
    <UiContainer>
        <div class="item-grid">
            {#each save.player.inventory.items as item, index}
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
        <ItemView
            {selectedItem}
            {selectedIndex}
            createItem={(item) => {
                try {
                    if (item === "") {
                        return toastManager.add(
                            new Toast(
                                "You must enter an item name first",
                                "failure",
                            ),
                        );
                    }
                    const newItem = Item.fromName(item);
                    save.player.inventory.setItem(selectedIndex, newItem);
                } catch (e) {
                    toastManager.add(
                        new Toast("Failed to create item", "failure"),
                    );
                    throw e;
                }
            }}
            deleteItem={() => {
                save.player.inventory.deleteItem(selectedIndex);
            }}
        />
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
