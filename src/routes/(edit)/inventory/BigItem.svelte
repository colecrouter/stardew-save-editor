<script lang="ts">
    import { DefaultFurnitureSizes } from '$lib/ItemData';
    import { GetSpritesheet } from '$lib/Spritesheet';
    import { getContext } from 'svelte';
    import type { BigCraftable, Boots, Clothing, Furniture, FurnitureType, Hat, ItemInformation, ObjectInformation, Tool, Weapon } from '../../../types/items';
    import type { Item } from '../../../types/save/1.5';
    import './Item.css';

    let spritesheet: string | undefined;
    let lookupItem: ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool | undefined;
    export let item: Item | undefined;

    const itemData = getContext('itemData') as Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>;
    if (!itemData) throw new Error('No item data found');

    let w: number, h: number;

    $: {
        if (!item) {
            spritesheet = undefined;
            lookupItem = undefined;
            break $;
        }

        lookupItem = itemData.get(item.name === 'Clothing' ? (item.parentSheetIndex === 1064 ? 'Shirt' : 'Pants') : item.name);

        if (item.name === 'Fishing Rod') {
            spritesheet = 'tools.png';

            let name: string;
            switch (item.upgradeLevel) {
                default:
                case 0:
                    name = 'Training Rod';
                    break;
                case 1:
                    name = 'Bamboo Pole';
                    break;
                case 2:
                    name = 'Fiberglass Rod';
                    break;
                case 3:
                    name = 'Iridium Rod';
                    break;
            }

            lookupItem = itemData.get(name);
        }

        if (!lookupItem) {
            console.error(`No item found for ${item.name}`);
        }

        if (lookupItem) {
            spritesheet = GetSpritesheet(lookupItem);
            if (lookupItem._type === 'Furniture') {
                const size = DefaultFurnitureSizes.get(lookupItem.type as FurnitureType);
                h = size?.height ?? 16;
                w = size?.width ?? 16;

                // -1 means default size
                if (lookupItem.tilesheetSize !== -1) {
                    w = lookupItem.tilesheetSize.width * 16;
                    h = lookupItem.tilesheetSize.height * 16;
                }
            } else if (lookupItem._type === 'Clothing' && lookupItem.type === 'Shirt') {
                w = h = 8;
            } else if (lookupItem._type === 'Hat') {
                w = h = 20;
            } else if (lookupItem._type === 'BigCraftable') {
                w = 16;
                h = 32;
            } else {
                w = h = 16;
            }

            // Shirt, there are multiple "Shirt"s, so we have to create a copy item object with the correct sprite.
            // Word on clothes, if your save is older than 1.4, then you'll have to update before your clothes will show up.
            // Clothes weren't items until 1.4, they were a character property before then.
            // https://stardewvalleywiki.com/Version_History#1.4
            if (item.clothesType === 0) {
                const sprite = lookupItem.sprite;
                lookupItem = {
                    ...lookupItem,
                    sprite,
                } as ItemInformation;
            } else if (item.clothesType === 1) {
                const sprite = lookupItem.sprite;
                lookupItem = {
                    ...lookupItem,
                    sprite,
                } as ItemInformation;
            }
        }
    }
</script>

<div class="item-wrapper">
    <div
        class="item"
        style:--w={`${w}px`}
        style:--h={`${h}px`}
        style:--z={`${32 / Math.max(w, h, 16)}`}
        style:--x={spritesheet && lookupItem && `${lookupItem?.sprite.x}px`}
        style:--y={spritesheet && lookupItem && `${lookupItem?.sprite.y}px`}
        style:--sprite={spritesheet && lookupItem && `url(/assets/${spritesheet})`}
        style:--tint={`rgb(${item?.clothesColor?.R ?? 0},${item?.clothesColor?.G ?? 0},${item?.clothesColor?.B ?? 0})`}
        class:dyeable={lookupItem?._type === 'Clothing' && lookupItem.dyeable}
        class:shirt={lookupItem?._type === 'Clothing' && lookupItem.type === 'Shirt'}
        class:craftable={lookupItem?._type === 'BigCraftable'} />
</div>

<style>
    .item-wrapper {
        zoom: 2;
    }

    .item-wrapper:hover::after {
        display: none;
    }
</style>
