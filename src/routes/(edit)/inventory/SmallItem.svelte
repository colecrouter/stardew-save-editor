<script lang="ts">
    import { getContext } from 'svelte';
    import type { BigCraftable, Boots, Clothing, Furniture, Hat, ObjectInformation, Tool, Weapon } from '../../../types/dump';
    import type { Item } from '../../../types/save/1.5.6';
    import { GetSpritesheet } from '$lib/Spritesheet';

    let spritesheet: string | undefined;
    let lookupItem: ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool | undefined;
    export let item: Item | undefined;
    export let selectedItem: Item | undefined;

    const itemData = getContext('itemData') as Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>;
    if (!itemData) throw new Error('No item data found');

    // TODO clean up
    $: if (item) {
        lookupItem = itemData.get(item.Name);
        if (lookupItem) {
            spritesheet = GetSpritesheet(lookupItem);
        } else {
            console.error(`No item found for ${JSON.stringify(item)}`);
        }
    } else {
        lookupItem = undefined;
        spritesheet = undefined;
    }

    const handleClick = () => (selectedItem = lookupItem ? item : undefined);
</script>

<div class="wrapper" on:click={handleClick}>
    <div
        class="item"
        style:--x={spritesheet && lookupItem && `${lookupItem?.sprite.x}px`}
        style:--y={spritesheet && lookupItem && `${lookupItem?.sprite.y}px`}
        style:--sprite={spritesheet && lookupItem && `url(/assets/${spritesheet})`}
        style:--r={item?.clothesColor?.R}
        style:--g={item?.clothesColor?.G}
        style:--b={item?.clothesColor?.B}
        class:tint={(lookupItem?._type === 'Clothing' && lookupItem.dyeable) || item?.dyeable}
        class:clothing={lookupItem?._type === 'Clothing' && lookupItem.type === 'Shirt'} />
</div>

<style>
    .item {
        width: 16px;
        height: 16px;
        background-image: var(--sprite);
        background-position: right var(--x) bottom var(--y);
        image-rendering: pixelated;
        margin-top: -1px;
    }

    /* .item.tint::after {
        content: '';
        width: 16px;
        height: 16px;
        position: absolute;
        background-color: rgba(var(--r), var(--g), var(--b), 0.5);
        cursor: pointer;
        background-blend-mode: multiply;
    } */

    .item.clothing {
        width: 8px;
        height: 8px;
        margin: 4px;
    }

    .item:hover::after {
        content: '';
        width: 16px;
        height: 16px;
        position: absolute;
        background-color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
    }

    .item.item.clothing:hover::after {
        margin-top: -4px;
        margin-left: -4px;
    }

    .wrapper {
        zoom: 2;
        border: solid 1px;
        border-bottom-color: #ffe4a1;
        border-left-color: #ffe4a1;
        border-right-color: #d68f54;
        border-top-color: #d68f54;
    }
</style>
