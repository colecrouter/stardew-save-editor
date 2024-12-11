<script lang="ts">
    import { base } from "$app/paths";
    import type { Item } from "$lib/proxies/Item";

    interface Props {
        item: Item | undefined;
    }

    let { item }: Props = $props();

    let spritesheet = $derived(item?.sprite?.sheet);
    let x = $derived(item?.sprite?.dimensions.x);
    let y = $derived(item?.sprite?.dimensions.y);
    let w = $derived(item?.sprite?.dimensions.width);
    let h = $derived(item?.sprite?.dimensions.height);
</script>

{#if item}
    {#if item.info}
        <div
            class="item"
            style:--w={`${w}px`}
            style:--h={`${h}px`}
            style:--z={`${32 / Math.max(w ?? 0, h ?? 0, 16)}`}
            style:--x={`${x}px`}
            style:--y={`${y}px`}
            style:--sprite={spritesheet && `url(${base}/assets/${spritesheet})`}
            style:--tint={`rgb(${item?.color?.R ?? 0},${item?.color?.G ?? 0},${item?.color?.B ?? 0})`}
            class:dyeable={item && "color" in item && item.color}
            class:hat={item && item.type === "Hat"}
        ></div>
    {:else}
        <div class="item">??</div>
    {/if}
{/if}

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

    /* If spritesheet its "/assets/hats.png", then move the item down by 6px */
    .item.hat::before {
        margin-top: 6px;
    }
</style>
