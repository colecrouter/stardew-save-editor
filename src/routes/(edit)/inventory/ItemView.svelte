<script lang="ts">
    import { ItemNameHelper } from "$lib/ItemData";
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import { Color } from "$lib/proxies/Color";
    import type { Item } from "$lib/proxies/Item";
    import UiInput from "$lib/ui/UIInput.svelte";
    import ItemSlot from "./ItemSlot.svelte";
    import ItemSprite from "./ItemSprite.svelte";
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

    const properties = [
        ["Amount", "amount", 1, 9999],
        ["Min Dmg", "minDamage", 0, 999],
        ["Max Dmg", "maxDamage", 0, 999],
        ["Knockback", "knockback", 0, 999],
        ["Speed", "speed", 0, 999],
        ["Precision", "precision", 0, 999],
        ["Defense", "defense", 0, 999],
        ["Area of Effect", "areaOfEffect", 0, 999],
        ["Crit Chance", "critChance", 0, 1, 0.01],
        ["Crit Multiplier", "critMultiplier", 0, 999],
        ["Immunity Bonus", "immunityBonus", 0, 999],
        ["Color Index", "raw.indexInColorSheet", 0, 71],
        ["Edibility", "edibility", 0, 999],
        // ["Place Outdoors", "setOutdoors", 0, 1],
        // ["Place Indoors", "setIndoors", 0, 1],
        // ["Produces Light", "isLamp", 0, 1],
        ["Price", "price", 0, 2 ** 31 - 1], // 32 bit signed int
        ["Color", "color", null, null],
        ["Quality", "quality", null, null],
    ] as [
        string,
        keyof Item,
        number | null,
        number | null,
        number | undefined,
    ][];
</script>

<div class="editor">
    <!-- Item icon -->
    <div class="big-icon">
        <ItemSlot>
            <ItemSprite item={selectedItem} />
        </ItemSlot>
    </div>

    <!-- Item stats -->
    <div class="stats">
        {#if selectedItem}
            <label>
                <small>Item Name</small>
                <UiInput
                    type="text"
                    value={ItemNameHelper(selectedItem.raw)}
                    disabled
                />
            </label>
            {#each properties as [label, key, min, max, step]}
                {#if selectedItem[key] !== undefined}
                    <label>
                        <small>{label}</small>
                        {#if key === "quality"}
                            <QualitySelector bind:item={selectedItem} />
                        {:else if typeof selectedItem[key] === "number"}
                            <UiInput
                                type="number"
                                bind:value={selectedItem[key]}
                                data-testid={`property-${key}`}
                                {min}
                                {max}
                                {step}
                            />
                        {:else if typeof selectedItem[key] === "string"}
                            <UiInput
                                type="text"
                                bind:value={selectedItem[key]}
                            />
                        {:else if selectedItem[key] instanceof Color}
                            <UiInput
                                type="color"
                                value={selectedItem[key].toHex()}
                                onchange={(e) => {
                                    if (!selectedItem) return;
                                    // @ts-expect-error some props are readonly
                                    selectedItem[key] = new Color(
                                        // @ts-expect-error
                                        e.target.value,
                                    );
                                }}
                                data-testid="color-picker"
                            />
                        {/if}
                    </label>
                {/if}
            {/each}
        {:else if selectedIndex}
            <label>
                <small>Item Name</small>
                <UiInput
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
    .big-icon {
        pointer-events: none;
        touch-action: none;
        zoom: 2;
    }

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
