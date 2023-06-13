<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import { getContext } from 'svelte';
    import type { Item } from '../../../types/save/1.5.6';
    import Container from '../../Container.svelte';
    import BigItem from './BigItem.svelte';
    import SmallItem from './SmallItem.svelte';
    import type { ObjectInformation, BigCraftable, Clothing, Furniture, Hat, Weapon, Tool, Boots } from '../../../types/dump';

    const itemData = getContext<Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>>('itemData');

    let hotbar: Array<string | Item> = [];
    let inventory: Array<string | Item> = [];
    let selectedItem: Item | undefined;

    SaveGame.subscribe((save) => {
        if (!save) return;
        hotbar = save.SaveGame.player.items.Item.slice(0, 12);
        inventory = save.SaveGame.player.items.Item.slice(12);
    });

    // Selected item attributes
    let type: 'Tool' | 'ObjectInformation' | 'BigCraftable' | 'Boots' | 'Clothing' | 'Furniture' | 'Hat' | 'MeleeWeapon' | 'RangedWeapon' | undefined;
    $: (() => {
        const item = selectedItem ? itemData.get(selectedItem?.Name) : undefined;
        type = item?._type;
        console.log(selectedItem);
    })();
</script>

<!-- Inventory view -->
<Container>
    <div class="grid-group">
        {#each hotbar as item}
            <SmallItem {item} bind:selectedItem />
        {/each}
    </div>
    <br />
    <div class="grid-group">
        {#each inventory as item}
            <SmallItem {item} bind:selectedItem />
        {/each}
    </div>
</Container>

<!-- Item view -->
<Container>
    <div class="editor">
        <BigItem item={selectedItem} />
        {#if selectedItem}
            <div class="column">
                <label>
                    <small>Display Name</small>
                    <input type="text" bind:value={selectedItem.DisplayName} />
                </label>
                {#if selectedItem.Stackable === undefined || selectedItem.Stackable === true}
                    <label>
                        <small>Amount</small>
                        <input type="number" bind:value={selectedItem.stack} min="0" />
                    </label>
                {/if}
                {#if type === 'MeleeWeapon'}
                    <label>
                        <small>Min Dmg</small>
                        <input type="number" bind:value={selectedItem.minDamage} min="0" />
                    </label>
                    <label>
                        <small>Max Dmg</small>
                        <input type="number" bind:value={selectedItem.maxDamage} min="0" />
                    </label>
                    <label>
                        <small>Knockback</small>
                        <input type="number" bind:value={selectedItem.knockback} min="0" />
                    </label>
                    <label>
                        <small>Speed</small>
                        <input type="number" bind:value={selectedItem.speed} min="0" />
                    </label>
                    <label>
                        <small>Added Precision</small>
                        <input type="number" bind:value={selectedItem.addedPrecision} min="0" />
                    </label>
                    <label>
                        <small>Added Defense</small>
                        <input type="number" bind:value={selectedItem.addedDefense} min="0" />
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
                        <input type="number" bind:value={selectedItem.addedAreaOfEffect} min="0" />
                    </label>
                    <label>
                        <small>Crit Chance</small>
                        <input type="number" bind:value={selectedItem.critChance} min="0" />
                    </label>
                    <label>
                        <small>Crit Dmg</small>
                        <input type="number" bind:value={selectedItem.critMultiplier} min="0" />
                    </label>
                {:else if type === 'RangedWeapon'}
                    <!-- Nothing to edit -->
                {:else if type === 'Tool'}
                    <!-- Can't edit -->
                {:else if type === 'BigCraftable'}
                    <label>
                        <small>Price</small>
                        <input type="number" bind:value={selectedItem.price} min="0" />
                    </label>
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
                        <input type="check" bind:value={selectedItem.isLamp} />
                    </label>
                {:else if type === 'Boots'}
                    <label>
                        <small>Added Defense</small>
                        <input type="number" bind:value={selectedItem.addedDefense} min="0" />
                    </label>
                    <label>
                        <small>Added Immunity</small>
                        <input type="number" bind:value={selectedItem.addedImmunity} min="0" />
                    </label>
                    <label>
                        <small>Color Index</small>
                        <input type="number" bind:value={selectedItem.indexInColorSheet} min="0" max="71" />
                    </label>
                {:else if type === 'Clothing'}
                    <label>
                        <small>Price</small>
                        <input type="number" bind:value={selectedItem.price} min="0" />
                    </label>
                    <label>
                        <small>Dyable</small>
                        <input type="check" bind:value={selectedItem.dyeable} />
                    </label>
                {:else if type === 'Furniture'}
                    <label>
                        <small>Price</small>
                        <input type="number" bind:value={selectedItem.price} min="0" />
                    </label>
                {:else if type === 'Hat'}
                    <!-- Need more info? -->
                {/if}
            </div>
        {/if}
    </div>
</Container>

<style>
    .grid-group {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-auto-rows: 32px;
    }

    .editor {
        display: flex;
        flex-direction: row;
        align-items: start;
        gap: 8px;
    }

    .column {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .editor label {
        display: flex;
        width: 100%;
        flex-direction: row;
        gap: 2px;
        white-space: nowrap;
        justify-content: space-between;
    }
</style>
