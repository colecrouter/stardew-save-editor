<script lang="ts">
    import { base } from "$app/paths";
    import {
        DefaultFurnitureSizes,
        ItemData,
        ItemNameHelper,
        Shirts,
    } from "$lib/ItemData";
    import type { Item } from "$lib/proxies/Item";
    import { GetSprite, GetSpritesheet } from "$lib/Spritesheet";
    import type { FurnitureType } from "$types/items/1.6";

    interface Props {
        item: Partial<Item> | undefined;
    }

    let { item }: Props = $props();

    let lookupItem = $derived(
        item
            ? // Shirt hack
              "id" in item && item.id !== undefined && item.name === "Shirt"
                ? Shirts.get(item.id)
                : ItemData.get(
                      item.name === "Clothing"
                          ? item.raw?.parentSheetIndex === 1064
                              ? "Shirt"
                              : "Pants"
                          : // @ts-expect-error
                            ItemNameHelper(item),
                  )
            : undefined,
    );

    let spritesheet = $derived(lookupItem && GetSpritesheet(lookupItem));
    let x = $state(0);
    let y = $state(0);
    let w = $state(0);
    let h = $state(0);

    $effect(() => {
        if (lookupItem) {
            if (lookupItem._type === "Furniture") {
                const size = DefaultFurnitureSizes.get(
                    lookupItem.Type as FurnitureType,
                );
                h = size?.height ?? 16;
                w = size?.width ?? 16;

                // -1 means default size
                if (lookupItem.TilesheetSize !== -1) {
                    w = lookupItem.TilesheetSize.width * 16;
                    h = lookupItem.TilesheetSize.height * 16;
                }
            } else if (lookupItem._type === "Shirt") {
                w = h = 8;
            } else if (lookupItem._type === "Hat") {
                w = h = 20;
            } else if (lookupItem._type === "BigCraftable") {
                w = 16;
                h = 32;
            } else {
                w = h = 16;
            }

            if (
                "MenuSpriteIndex" in lookupItem &&
                lookupItem.MenuSpriteIndex !== -1
            ) {
                const sprite = GetSprite(
                    lookupItem,
                    lookupItem.MenuSpriteIndex,
                );
                x = sprite.x;
                y = sprite.y;
            } else if ("SpriteIndex" in lookupItem) {
                const sprite = GetSprite(
                    lookupItem,
                    lookupItem.SpriteIndex ?? 0,
                );
                x = sprite.x;
                y = sprite.y;
            } else if ("Sprite" in lookupItem) {
                x = lookupItem.Sprite.x;
                y = lookupItem.Sprite.y;
            }

            // Shirt, there are multiple "Shirt"s, so we have to create a copy item object with the correct sprite.
            // Word on clothes, if your save is older than 1.4, then you'll have to update before your clothes will show up.
            // Clothes weren't items until 1.4, they were a character property before then.
            // https://stardewvalleywiki.com/Version_History#1.4
            // if (lookupItem._type === 'Shirt') {
            //     const sprite = lookupItem.SpriteIndex;
            //     lookupItem = {
            //         ...lookupItem,
            //         SpriteIndex: sprite,
            //     } satisfies ItemInformation;
            // }
        }
    });
</script>

<div
    class="item"
    style:--w={`${w}px`}
    style:--h={`${h}px`}
    style:--z={`${32 / Math.max(w, h, 16)}`}
    style:--x={spritesheet && lookupItem && `${x}px`}
    style:--y={spritesheet && lookupItem && `${y}px`}
    style:--sprite={spritesheet &&
        lookupItem &&
        `url(${base}/assets/${spritesheet})`}
    style:--tint={`rgb(${item?.color?.R ?? 0},${item?.color?.G ?? 0},${item?.color?.B ?? 0})`}
    class:dyeable={(lookupItem?._type === "Shirt" ||
        lookupItem?._type === "Pants") &&
        lookupItem.CanBeDyed}
></div>

<style>
    .item {
        position: relative;
        transition: transform 0.1s;
        cursor: pointer;
    }

    .item:hover {
        transform: scale(1.2);
        transform-origin: center;
    }

    .item::before {
        content: "";
        display: block;
        background-image: var(--sprite);
        background-position: left var(--x) top var(--y);
        image-rendering: pixelated;
        width: var(--w);
        height: var(--h);
        zoom: var(--z);
    }

    .item.dyeable::after {
        content: "";
        position: absolute;
        top: 0;
        width: var(--w);
        height: var(--h);
        mix-blend-mode: multiply;
        background-color: var(--tint);
        -webkit-mask-image: var(--sprite);
        mask-image: var(--sprite);
        -webkit-mask-position: left var(--x) top var(--y);
        mask-position: left var(--x) top var(--y);
        zoom: var(--z);
    }
</style>
