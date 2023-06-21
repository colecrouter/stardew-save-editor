<script lang="ts" context="module">
    const hexToRGB = (hex: string): Partial<HairstyleColor> => {
        const R = parseInt(hex.slice(1, 3), 16);
        const G = parseInt(hex.slice(3, 5), 16);
        const B = parseInt(hex.slice(5, 7), 16);

        return { R, G, B };
    };

    const RGBToHex = (rgb: HairstyleColor): string => {
        const { R, B, G } = rgb;

        const hex = ((R << 16) | (G << 8) | B).toString(16);

        return '#' + new Array(Math.abs(hex.length - 7)).join('0') + hex;
    };
</script>

<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import { getContext } from 'svelte';
    import type { BigCraftable, Boots, Clothing, Furniture, Hat, ObjectInformation, Tool, Weapon } from '../../../types/dump';
    import { Category, type HairstyleColor, type Item } from '../../../types/save/1.5.6';
    import Container from '../../Container.svelte';
    import BigItem from './BigItem.svelte';
    import QualitySelector from './QualitySelector.svelte';
    import SmallItem from './SmallItem.svelte';

    // TODO: I don't know what items are allowed to have quality, or if there's some sort of rule.
    const qualityCategories: Array<Category> = [
        Category.Fish,
        Category.Egg,
        Category.Milk,
        Category.Cooking,
        Category.SellAtPierres,
        Category.SellAtPierresAndMarnies,
        Category.ArtisanGoods,
        Category.Syrup,
        Category.Vegetable,
        Category.Fruit,
        Category.Flower,
        Category.Forage,
    ];

    const itemData = getContext<Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>>('itemData');

    let hotbar: Array<Item | undefined> = [];
    let inventory: Array<Item | undefined> = [];
    let selectedItem: Item | undefined;

    let boots: Item | undefined;
    let pants: Item | undefined;
    let shirt: Item | undefined;
    let hat: Item | undefined;
    let leftRing: Item | undefined;
    let rightRing: Item | undefined;

    let playerName: string;
    let farmName: string;
    let currentFunds: number;
    let totalEarnings: number;

    let save: SaveFile;
    SaveGame.subscribe((s) => {
        if (!s) return;

        save = s;

        hotbar = save.SaveGame.player.items.Item.slice(0, 12);
        inventory = save.SaveGame.player.items.Item.slice(12);

        boots = save.SaveGame.player.boots;
        pants = save.SaveGame.player.pantsItem;
        shirt = save.SaveGame.player.shirtItem;
        hat = save.SaveGame.player.hat;
        leftRing = save.SaveGame.player.leftRing;
        rightRing = save.SaveGame.player.rightRing;

        playerName = save.SaveGame.player.name;
        farmName = save.SaveGame.player.farmName;
        currentFunds = save.SaveGame.player.money;
        totalEarnings = save.SaveGame.player.totalMoneyEarned;
    });

    // Update save when changes are made
    $: save && (save.SaveGame.player.boots = typeof boots == 'string' ? undefined : boots);
    $: save && (save.SaveGame.player.pantsItem = typeof pants == 'string' ? undefined : pants);
    $: save && (save.SaveGame.player.shirtItem = typeof shirt == 'string' ? undefined : shirt);
    $: save && (save.SaveGame.player.hat = typeof hat == 'string' ? undefined : hat);
    $: save && (save.SaveGame.player.leftRing = typeof leftRing == 'string' ? undefined : leftRing);
    $: save && (save.SaveGame.player.rightRing = typeof rightRing == 'string' ? undefined : rightRing);

    $: save && (save.SaveGame.player.name = playerName);
    $: save && (save.SaveGame.player.farmName = farmName);
    $: save && (save.SaveGame.player.money = currentFunds);
    $: save && (save.SaveGame.player.totalMoneyEarned = totalEarnings);

    // Selected item attributes
    let type: 'Tool' | 'ObjectInformation' | 'BigCraftable' | 'Boots' | 'Clothing' | 'Furniture' | 'Hat' | 'MeleeWeapon' | 'RangedWeapon' | undefined;
    $: (() => {
        const item = selectedItem ? itemData.get(selectedItem?.Name) : undefined;
        type = item?._type;

        selectedItem && console.debug('Selected item:', selectedItem?.Name);
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

<!-- Character View -->
<Container>
    <div class="character-details">
        <div class="character-inner">
            <div class="character-group">
                <div class="character-armor">
                    <SmallItem item={leftRing} bind:selectedItem />
                    <SmallItem item={rightRing} bind:selectedItem />
                    <SmallItem item={boots} bind:selectedItem />
                </div>
                <div class="character-appearance">
                    <!-- TODO -->
                </div>
                <div class="character-armor">
                    <SmallItem item={hat} bind:selectedItem />
                    <SmallItem item={shirt} bind:selectedItem />
                    <SmallItem item={pants} bind:selectedItem />
                </div>
            </div>

            <input type="text" class="character-name" bind:value={playerName} />
        </div>
        <div class="character-info">
            <label>
                <span hidden>Farm Name:</span>
                <input type="text" bind:value={farmName} />
            </label>
            <label>
                Current Funds:
                <input type="number" bind:value={currentFunds} />
            </label>
            <label>
                Total Earnings:
                <input type="number" bind:value={totalEarnings} />
            </label>
        </div>
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
                {#if (selectedItem.Stackable === undefined || selectedItem.Stackable === true) && type !== 'Clothing' && type !== 'Boots' && type !== 'Hat'}
                    <label>
                        <small>Amount</small>
                        <input type="number" bind:value={selectedItem.stack} min="0" max="999" />
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
                        <input type="checkbox" bind:checked={selectedItem.isLamp} />
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
                    {#if selectedItem.dyeable}
                        <label>
                            <small>Color</small>
                            <input
                                type="color"
                                value={RGBToHex(selectedItem.clothesColor)}
                                on:change={(e) => {
                                    // @ts-expect-error
                                    selectedItem.clothesColor = hexToRGB(e.target.value ?? '#000000');
                                }} />
                        </label>
                    {/if}
                {:else if type === 'Furniture'}
                    <label>
                        <small>Price</small>
                        <input type="number" bind:value={selectedItem.price} min="0" />
                    </label>
                {:else if type === 'Hat'}
                    <!-- Need more info? -->
                {/if}

                <!-- Quality selector -->
                <!-- svelte-ignore a11y-label-has-associated-control -->
                {#if selectedItem.quality !== 0 || qualityCategories.includes(selectedItem.category)}
                    <label>
                        <small>Quality</small>
                        <QualitySelector bind:item={selectedItem} />
                    </label>
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

    .character-inner {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .character-details {
        display: flex;
        flex-direction: row;
        gap: 4px;
    }

    .character-group {
        display: flex;
        flex-direction: row;
        gap: 4px;
    }

    .character-appearance {
        width: 50px;
        height: 90px;
        margin: 6px;
        box-shadow: 0 0 0 2px #8e3d04, 0 0 0 4px #d97804, 0 0 0 6px #5b2b29;
        border-radius: 2px;
    }

    .character-info {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        text-align: center;
        font-size: 1.2em;
        gap: 8px;
    }

    .character-info > label {
        display: block;
    }

    .character-info input[type='number'] {
        width: 6em;
    }

    .character-details input {
        text-align: center;
    }

    .character-name {
        width: 10em;
    }

    small {
        min-width: 5em;
    }
</style>
