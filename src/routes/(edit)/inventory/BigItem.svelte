<script lang="ts">
    import { getContext } from 'svelte';
    import type { Item } from '../../../types/save/1.5.6';
    import type { BigCraftable, Boots, Clothing, Furniture, Hat, ObjectInformation, Tool, Weapon } from '../../../types/dump';
    import { GetSpritesheet } from '$lib/Spritesheet';

    let spritesheet: string | undefined;
    let lookupItem: ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool | undefined;
    export let item: Item | undefined;

    const itemData = getContext('itemData') as Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>;
    if (!itemData) throw new Error('No item data found');

    $: {
        if (!item) {
            spritesheet = undefined;
            lookupItem = undefined;
            break $;
        }

        lookupItem = itemData.get(item.Name);
        if (!lookupItem) break $;
        spritesheet = GetSpritesheet(lookupItem);
    }
</script>

<div class="wrapper">
    <div
        class="item"
        style:--x={spritesheet && lookupItem && `${lookupItem?.sprite.x}px`}
        style:--y={spritesheet && lookupItem && `${lookupItem?.sprite.y}px`}
        style:--sprite={spritesheet && lookupItem && `url(/assets/${spritesheet})`}
        class:clothing={lookupItem && lookupItem._type === 'Clothing' && lookupItem.type === 'Shirt'} />
</div>

<style>
    .item {
        width: 16px;
        height: 16px;
        background-image: var(--sprite);
        background-position: right var(--x) bottom var(--y);
        image-rendering: pixelated;
    }

    .item.clothing {
        width: 8px;
        height: 8px;
        margin: 4px;
    }

    .wrapper {
        width: 16px;
        height: 16px;
        zoom: 4;
        border: solid 1px;
        border-bottom-color: #ffe4a1;
        border-left-color: #ffe4a1;
        border-right-color: #d68f54;
        border-top-color: #d68f54;
    }
</style>
