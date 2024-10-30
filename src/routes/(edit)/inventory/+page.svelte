<script lang="ts">
    import { createItem as create } from "$lib/Item";
    import { ItemData } from "$lib/ItemData";
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import { saveManager } from "$lib/SaveFile.svelte";
    import type { Item } from "$types/save/1.6";
    import Container from "../../Container.svelte";
    import CharacterView from "./CharacterView.svelte";
    import ItemView from "./ItemView.svelte";
    import SmallItem from "./SmallItem.svelte";

    let selectedItem: Item | undefined = $state();
    let selectedIndex: ParentIndex = $state(0);

    const deleteItem = (symbol: ParentIndex) => {
        if (!saveManager.player || !saveManager.inventory) return;

        if (typeof symbol === "number") {
            saveManager.inventory[symbol] = undefined;
        } else {
            saveManager.player[symbol] = undefined;
        }

        // Clear item from the editor window
        selectedItem = undefined;
    };

    const createItem = (symbol: ParentIndex, item: string) => {
        if (!saveManager.player || !saveManager.inventory) return;

        try {
            const newItem = create(item);

            if (typeof symbol === "number") {
                saveManager.inventory[symbol] = newItem;
            } else {
                saveManager.player[symbol] = newItem;
            }

            // Select the new item
            selectedItem = newItem;
        } catch (e) {
            alert(`Unable to create item: ${e}`);
        }
    };
</script>

<!-- Data list for adding new items -->
<datalist id="new-items">
    {#each Array.from(ItemData.keys()) as name}
        <option value={name}></option>
    {/each}
</datalist>

{#if saveManager.inventory}
    <!-- Inventory view -->
    <Container>
        <div class="item-grid">
            {#each saveManager.inventory as item, index}
                <SmallItem
                    {item}
                    {index}
                    bind:selectedItem
                    bind:selectedIndex
                />
            {/each}
        </div>
    </Container>

    <!-- Character View -->
    <Container>
        {#if saveManager.player}
            <CharacterView
                player={saveManager.player}
                bind:selectedIndex
                bind:selectedItem
            />
        {/if}
    </Container>

    <!-- Item view -->
    <Container>
        <ItemView
            {selectedItem}
            {selectedIndex}
            createItem={(item) => createItem(selectedIndex, item)}
            deleteItem={() => deleteItem(selectedIndex)}
        />
    </Container>
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
