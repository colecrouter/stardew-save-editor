<script lang="ts">
    import { ItemData } from "$lib/ItemData";
    import type { ParentIndex } from "$lib/ItemParentIndex";
    // biome-ignore lint/style/useImportType: bug(?) static method being used below
    import { Item } from "$lib/proxies/Item";
    import { saveManager } from "$lib/save.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import CharacterView from "./CharacterView.svelte";
    import ItemView from "./ItemView.svelte";
    import SmallItem from "./SmallItem.svelte";
    import {
        draggable,
        droppable,
        type DragDropState,
    } from "@thisux/sveltednd";

    let selectedItem: Item | undefined = $state();
    let selectedIndex: ParentIndex = $state(0);
    const save = saveManager.save;
    if (!save) throw new Error("No save data found");

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
        selectedItem = currentItem;
    }
</script>

<!-- Data list for adding new items -->
<datalist id="new-items">
    {#each Array.from(ItemData.keys()) as name}
        <option value={name}></option>
    {/each}
</datalist>

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
                    onclick={() => {
                        selectedItem = item;
                        selectedIndex = index;
                    }}
                >
                    <div
                        use:draggable={{
                            container: index.toString(),
                            dragData: "asd",
                        }}
                    >
                        <SmallItem
                            {item}
                            {index}
                            bind:selectedItem
                            bind:selectedIndex
                        />
                    </div>
                </div>
            {/each}
        </div>
    </UiContainer>

    <!-- Character View -->
    <UiContainer>
        {#if save.player}
            <CharacterView
                player={save.player}
                bind:selectedIndex
                bind:selectedItem
            />
        {/if}
    </UiContainer>

    <!-- Item view -->
    <UiContainer>
        <ItemView
            {selectedItem}
            {selectedIndex}
            createItem={(item) => {
                const newItem = Item.fromName(item);
                save.player.inventory.setItem(selectedIndex, newItem);
                selectedItem = newItem;
            }}
            deleteItem={() => {
                save.player.inventory.deleteItem(selectedIndex);
                selectedItem = undefined; // Clear the editor
            }}
        />
    </UiContainer>
{/if}

<style>
    .item-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-auto-rows: 32px;
        grid-template-rows: 48px auto auto;
    }

    :global([type="number"]) {
        width: 6em;
    }
</style>
