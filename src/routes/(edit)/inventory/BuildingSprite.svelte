<script lang="ts">
    import { base } from "$app/paths";
    import type { Building } from "$lib/proxies/Building";
    import buildings from "$generated/buildings.json";

    interface Props {
        building?: Building;
    }

    let { building }: Props = $props();

    const buildingData = buildings.find((b) => b.name === building?.name);

    let spritesheet = $derived(`buildings/${buildingData?.texture}`);
    let x = $derived(buildingData?.sprite.x);
    let y = $derived(buildingData?.sprite.y);
    let w = $derived(buildingData?.sprite.width);
    let h = $derived(buildingData?.sprite.height);
</script>

{#if building}
    {#if buildingData}
        <div
            class="item"
            style:--w={`${w}px`}
            style:--h={`${h}px`}
            style:--z={`${48 / Math.max(w ?? 0, h ?? 0, 16)}`}
            style:--x={`${x}px`}
            style:--y={`${y}px`}
            style:--sprite={`url("${base}/assets/${spritesheet}")`}
        ></div>
    {:else}
        <div class="item">??</div>
    {/if}
{/if}

<style>
    .item {
        content: "";
        display: block;
        background-image: var(--sprite);
        background-position: left var(--x) top var(--y);
        image-rendering: pixelated;
        width: var(--w);
        height: var(--h);
        zoom: var(--z);
    }
</style>
