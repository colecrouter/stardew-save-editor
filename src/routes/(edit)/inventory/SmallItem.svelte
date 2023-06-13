<script lang="ts">
    import { getContext } from 'svelte';
    import type { BigCraftable, Boots, Clothing, Furniture, Hat, ObjectInformation, Tool, Weapon } from '../../../types/dump';
    import type { Item } from '../../../types/save/1.5.6';

    let spritesheet: string | undefined;
    let lookupItem: ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool | undefined;
    export let item: Item | string;
    export let selectedItem: Item | undefined;

    if (typeof item == 'object') {
        const itemData = getContext('itemData') as Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>;
        if (!itemData) throw new Error('No item data found');

        lookupItem = itemData.get(item.Name);
        switch (lookupItem?._type) {
            case 'ObjectInformation':
            case 'Boots':
                spritesheet = 'springobjects.png';
                break;
            case 'BigCraftable':
                spritesheet = 'Craftables.png';
                break;
            case 'Hat':
                spritesheet = 'hats.png';
            case 'Clothing':
                // TODO
                break;
            case 'Furniture':
                spritesheet = 'furniture.png';
                break;
            case 'RangedWeapon':
            case 'MeleeWeapon':
                spritesheet = 'weapons.png';
                break;
            case 'Tool':
                spritesheet = 'tools.png';
                break;
            default:
                // @ts-expect-error
                console.warn('Unknown item type', lookupItem?._type);
        }

        // console.log(item);

        if (item.name === 'Fishing Rod') console.log(item);
    }

    const handleClick = () => (selectedItem = typeof item == 'object' ? item : undefined);
</script>

<!-- {item.IndexOfMenuItemView} -->
<div class="wrapper" on:click={handleClick}>
    <div class="item" style:--x={spritesheet && `${lookupItem?.sprite.x}px`} style:--y={spritesheet && `${lookupItem?.sprite.y}px`} style:--sprite={spritesheet && `url(/assets/${spritesheet})`} />
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

    .item:hover::after {
        content: '';
        width: 16px;
        height: 16px;
        position: absolute;
        background-color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
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
