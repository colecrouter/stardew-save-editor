<script lang="ts">
    import { run } from "svelte/legacy";

    import { createItem as create } from "$lib/Item";
    import { ItemData } from "$lib/ItemData";
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import { CalculateEdibility, CalculatePrice } from "$lib/ItemQuality";
    import { Character } from "$lib/SaveFile";
    import type { ItemInformation } from "$types/items/1.6";
    import type { Item, Player } from "$types/save/1.6";
    import Container from "../../Container.svelte";
    import CharacterView from "./CharacterView.svelte";
    import ItemView from "./ItemView.svelte";
    import SmallItem from "./SmallItem.svelte";

    let selectedItemData: ItemInformation | undefined = $state();

    let inventory: Array<Item | undefined> = $state([]);
    let selectedItem: Item | undefined = $state();
    let selectedIndex: ParentIndex = $state();

    // Update our reference to the select player
    let player: Player | undefined = $state();
    Character.character.subscribe((c) => {
        if (!c) return;

        player = c;
        inventory = c.items.Item;
    });

    // Price/edibility calculation
    let oldQuality: number | undefined = $state();

    run(() => {
        (() => {
            // Refresh the selected item hardcoded data
            selectedItemData = selectedItem
                ? ItemData.get(selectedItem?.name)
                : undefined;

            selectedItem &&
                console.debug(
                    "Selected item:",
                    selectedItem?.name,
                    selectedIndex,
                );

            // Calculate price/edibility for default price/edibility items
            if (selectedItem?.quality === undefined) return;

            try {
                // When the item is first clicked, oldQuality will be undefined
                if (oldQuality === undefined) oldQuality = selectedItem.quality;

                // If the quality hasn't changed, we don't need to do anything
                if (oldQuality === selectedItem.quality) return;

                if (!selectedItemData) return;

                // Check if the items price is the same as the default price
                // If so, we need to change the price whenever the quality changes
                // If not, we can assume the user has changed it, so just leave it alone
                if (
                    "Price" in selectedItemData &&
                    selectedItemData.Price !== undefined &&
                    selectedItem.price
                ) {
                    const theoreticalOldPrice = CalculatePrice(
                        selectedItemData.Price,
                        oldQuality ?? 0,
                    );
                    if (theoreticalOldPrice === selectedItem.price) {
                        selectedItem.price = CalculatePrice(
                            selectedItemData.Price,
                            selectedItem.quality,
                        );
                    }
                }

                if ("Edibility" in selectedItemData && selectedItem.edibility) {
                    const theoreticalOldEdibility = CalculateEdibility(
                        selectedItemData.Edibility,
                        oldQuality ?? 0,
                    );
                    if (theoreticalOldEdibility === selectedItem.edibility) {
                        selectedItem.edibility = CalculateEdibility(
                            selectedItemData.Edibility,
                            selectedItem.quality,
                        );
                    }
                }
            } finally {
                // Store the previous quality value at the end
                oldQuality = selectedItem.quality;
            }
        })();
    });

    const deleteItem = (symbol: ParentIndex) => {
        if (!player) return;

        if (typeof symbol === "number") {
            inventory[symbol] = undefined;
        } else {
            player[symbol] = undefined;
        }

        // Clear item from the editor window
        selectedItem = undefined;
        oldQuality = undefined;
    };

    const createItem = (symbol: ParentIndex, item: string) => {
        if (!player) return;

        try {
            const newItem = create(item);

            if (typeof symbol === "number") {
                inventory[symbol] = newItem;
            } else {
                player[symbol] = newItem;
            }

            // Select the new item
            selectedItem = newItem;
        } catch (e) {
            alert(`Unable to create item: ${e}`);
        }
    };

    const rerender = (item: Item, index: ParentIndex) => {
        if (!player) return;

        if (typeof index === "number") {
            inventory[index] = item;
        } else {
            player[index] = item;
        }
    };
</script>

<!-- Data list for adding new items -->
<datalist id="new-items">
    {#each Array.from(ItemData.keys()) as name}
        <option value={name}></option>
    {/each}
</datalist>

{#if player}
    <!-- Inventory view -->
    <Container>
        <div class="item-grid">
            {#each inventory as item, index}
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
        <CharacterView {player} bind:selectedIndex bind:selectedItem />
    </Container>

    <!-- Item view -->
    <Container>
        <ItemView
            {selectedItem}
            {selectedIndex}
            rerender={() =>
                selectedItem && rerender(selectedItem, selectedIndex)}
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
