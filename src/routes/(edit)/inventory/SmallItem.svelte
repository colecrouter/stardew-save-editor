<script lang="ts">
    import { getContext } from 'svelte';
    import type { BigCraftable, Boots, Clothing, Furniture, Hat, ObjectInformation, Tool, Weapon } from '../../../types/dump';
    import type { Item } from '../../../types/save/1.5.6';

    let spritesheet: string | undefined;
    let lookupItem: ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool | undefined;
    export let item: Item | undefined;
    export let selectedItem: Item | undefined;

    const itemData = getContext('itemData') as Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>;
    if (!itemData) throw new Error('No item data found');

    if (item) {
        // This doesn't work for empty slots
        // Empty inventory slots are <string xsi:nil="true" />, so we need to pretend like they don't exist.
        if (!('Name' in item)) {
            lookupItem = undefined;
            spritesheet = undefined;
        } else {
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
        }

        // console.log(item);

        if (item.name === 'Fishing Rod') console.log(item);
    }

    const handleClick = () => (selectedItem = lookupItem ? item : undefined);
</script>

<!-- {item.IndexOfMenuItemView} -->
<div class="wrapper" on:click={handleClick}>
    <div class="item" style:--x={spritesheet && lookupItem && `${lookupItem?.sprite.x}px`} style:--y={spritesheet && lookupItem && `${lookupItem?.sprite.y}px`} style:--sprite={spritesheet && lookupItem && `url(/assets/${spritesheet})`} />
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
