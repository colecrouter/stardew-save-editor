<script lang="ts">
    import {
        CategoriesWithQuality,
        ItemData,
        ItemNameHelper,
    } from "$lib/ItemData";
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import { Color } from "$lib/proxies/Color";
    import type { Item } from "$types/save/1.6";
    import BigItem from "./BigItem.svelte";
    import QualitySelector from "./QualitySelector.svelte";

    interface Props {
        selectedItem: Item | undefined;
        selectedIndex: ParentIndex | undefined;
        deleteItem: () => void;
        createItem: (name: string) => void;
    }

    let {
        selectedItem = $bindable(),
        selectedIndex,
        deleteItem,
        createItem,
    }: Props = $props();

    let newItemName = $state("");

    let selectedItemData = $derived(
        selectedItem ? ItemData.get(selectedItem.name) : undefined,
    );
</script>

<div class="editor">
    <!-- Item icon -->
    <BigItem bind:item={selectedItem} />

    <!-- Item stats -->
    <div class="stats">
        {#if selectedItem}
            <label>
                <small>Item Name</small>
                <input
                    type="text"
                    value={ItemNameHelper(selectedItem)}
                    disabled
                />
            </label>
            {#if selectedItemData}
                <!-- TODO: Since 1.6 removed stackable field, not sure how to actually know -->
                {#if !["Clothing", "Boots", "Hat", "Weapon", "Pants", "Shirt"].includes(selectedItemData._type)}
                    <label>
                        <small>Amount</small>
                        <input
                            type="number"
                            bind:value={selectedItem.stack}
                            min="0"
                            max="999"
                        />
                    </label>
                {/if}
                {#if selectedItemData._type === "Weapon"}
                    <label>
                        <small>Min Dmg</small>
                        <input
                            type="number"
                            bind:value={selectedItem.minDamage}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Max Dmg</small>
                        <input
                            type="number"
                            bind:value={selectedItem.maxDamage}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Knockback</small>
                        <input
                            type="number"
                            bind:value={selectedItem.knockback}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Speed</small>
                        <input
                            type="number"
                            bind:value={selectedItem.speed}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Added Precision</small>
                        <input
                            type="number"
                            bind:value={selectedItem.addedPrecision}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Added Defense</small>
                        <input
                            type="number"
                            bind:value={selectedItem.addedDefense}
                            min="0"
                        />
                    </label>
                    <!-- {#if 'weaponType' in selectedItem}
                      <label>
                          <small>Weapon Type</small>
                          <select>
                              <option value="0">Stabbing Sword</option>
                              <option value="1">Dagger</option>
                              <option value="2">Club/Hammer</option>
                              <option value="3">Slashing Sword</option>
                          </select>
                      </label>
                  {/if} -->
                    <label>
                        <small>Added Area of Effect</small>
                        <input
                            type="number"
                            bind:value={selectedItem.addedAreaOfEffect}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Crit Chance</small>
                        <input
                            type="number"
                            bind:value={selectedItem.critChance}
                            min="0"
                            max="1"
                            step="0.01"
                        />
                    </label>
                    <label>
                        <small>Crit Dmg</small>
                        <input
                            type="number"
                            bind:value={selectedItem.critMultiplier}
                            min="0"
                        />
                    </label>
                {:else if selectedItemData._type === "Tool"}
                    <!-- Can't edit -->
                {:else if selectedItemData._type === "BigCraftable"}
                    <!-- <label>
                      <small>Place Outdoors</small>
                      <input type="check" bind:value={selectedItem.setOutdoors} />
                  </label>
                  <label>
                      <small>Place Indoors</small>
                      <input type="check" bind:value={selectedItem.setIndoors} />
                  </label> -->
                    <label>
                        <small>Produces Light</small>
                        <input
                            type="checkbox"
                            bind:checked={selectedItem.isLamp}
                        />
                    </label>
                {:else if selectedItemData._type === "Boots"}
                    <label>
                        <small>Added Defense</small>
                        <input
                            type="number"
                            bind:value={selectedItem.defenseBonus}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Added Immunity</small>
                        <input
                            type="number"
                            bind:value={selectedItem.immunityBonus}
                            min="0"
                        />
                    </label>
                    <label>
                        <small>Color Index</small>
                        <input
                            type="number"
                            bind:value={selectedItem.indexInColorSheet}
                            min="0"
                            max="71"
                        />
                    </label>
                {:else if selectedItemData._type === "Shirt" || selectedItemData._type === "Pants"}
                    {#if "CanBeDyed" in selectedItemData && selectedItemData.CanBeDyed}
                        <label>
                            <small>Color</small>
                            <input
                                type="color"
                                value={new Color(
                                    selectedItem.clothesColor || "#ffffff",
                                ).toHex()}
                                onchange={(e) => {
                                    if (!selectedItem) return;
                                    selectedItem.clothesColor = new Color(
                                        // @ts-expect-error
                                        e.target.value,
                                    );
                                }}
                                data-testid="color-picker"
                            />
                        </label>
                    {/if}
                {:else if selectedItemData._type === "Furniture"}
                    <!-- Need more info -->
                    <!-- House plant selector -->
                {:else if selectedItemData._type === "Hat"}
                    <!-- Need more info? -->
                {/if}

                <!-- Quality selector -->
                <!-- svelte-ignore a11y_label_has_associated_control -->
                {#if selectedItem.category && CategoriesWithQuality.has(selectedItem.category)}
                    <label>
                        <small>Quality</small>
                        <QualitySelector bind:item={selectedItem} />
                    </label>
                {/if}

                <!-- Edibility -->
                {#if selectedItemData && "edibility" in selectedItemData && selectedItemData.edibility !== -300}
                    <label>
                        <small>Edibility</small>
                        <input
                            type="number"
                            bind:value={selectedItem.edibility}
                            min="0"
                        />
                    </label>
                {/if}

                <!-- Price -->
                {#if ["Object", "BigCraftable", "Furniture", "Hat", "Clothing"].includes(selectedItemData._type)}
                    <label>
                        <small>Price</small>
                        <input
                            type="number"
                            bind:value={selectedItem.price}
                            min="0"
                        />
                    </label>
                {/if}
            {/if}
        {:else if selectedIndex}
            <label>
                <small>Item Name</small>
                <input
                    type="text"
                    list="new-items"
                    data-testid="item-name"
                    bind:value={newItemName}
                />
            </label>
        {/if}
    </div>

    <!-- Delete/create the item -->
    <div class="edit">
        {#if selectedItem}
            <button
                class="btn btn-danger"
                onclick={() => {
                    if (selectedIndex) {
                        deleteItem();
                    }
                }}
            >
                🗑️
            </button>
        {:else if selectedIndex}
            <button
                class="btn btn-success"
                data-testid="create-item"
                onclick={() => {
                    if (selectedIndex) {
                        createItem(newItemName);
                        newItemName = "";
                    }
                }}
            >
                ➕
            </button>
        {/if}
    </div>
</div>

<style>
    .editor {
        /* Three sections, edges are fix size, middle expands */
        display: grid;
        grid-template-columns: min-content 5fr 1fr;
        flex-direction: row;
        gap: 8px;
    }

    .stats {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .edit {
        display: flex;
        flex-direction: column;
        justify-content: start;
        align-items: center;
    }

    .edit button {
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        margin-top: 16px;
        font-size: 1.5em;
        cursor: pointer;
    }

    .editor label {
        display: flex;
        width: 100%;
        flex-direction: row;
        gap: 2px;
        align-items: center;
        justify-content: space-between;
    }

    .editor small {
        margin-right: 2em;
    }
</style>
