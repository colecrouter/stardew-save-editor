<script lang="ts" module>
    function colorToString(color?: Color) {
        if (!color) return undefined;
        if (color.A !== 255) {
            return `rgba(${color.R},${color.G},${color.B},${color.A / 255})`;
        }
        return `rgb(${color.R},${color.G},${color.B})`;
    }

    function sheetUrl(sheet?: string) {
        return sheet && `url(${base}/assets/${sheet})`;
    }
</script>

<script lang="ts">
    import { base } from "$app/paths";
    import type { Color } from "$lib/proxies/Color";
    import type { Item } from "$lib/proxies/Item";

    interface Props {
        item: Item | undefined;
    }

    let { item }: Props = $props();

    // Main properties
    let spritesheet = $derived(sheetUrl(item?.sprite?.sheet));
    let spritePosition = $derived(item?.sprite?.dimensions);
    let x = $derived(spritePosition?.x);
    let y = $derived(spritePosition?.y);
    let w = $derived(item?.sprite?.dimensions.width);
    let h = $derived(item?.sprite?.dimensions.height);
    let zoom = $derived(32 / Math.max(w ?? 0, h ?? 0, 16));
    let blendingMode = $derived(
        item?.color?.A !== undefined ? "multiply" : "normal",
    );

    // Overlay properties
    let tint = $derived(colorToString(item?.color) ?? item?.info?.color);
    let smoked = $derived(item?.name.startsWith("Smoked"));
    let hasArtisanOverlay = $derived(item?.info?.color);
    let overlayPosition = $derived(
        hasArtisanOverlay
            ? { x: (x ?? 0) - 16, y } // Artisan overlay is always 16px to the left
            : (item?.sprite?.dimensions ?? { x: 0, y: 0 }), // For pants, its the same as the sprite
    );
    let overlayX = $derived(overlayPosition.x);
    let overlayY = $derived(overlayPosition.y);
</script>

{#if item}
    {#if item.info}
        <div
            class="item"
            style:--w={`${w}px`}
            style:--h={`${h}px`}
            style:--z={zoom}
            style:--x={`${x}px`}
            style:--y={`${y}px`}
            style:--sprite={spritesheet}
            style:mix-blend-mode={blendingMode}
            class:hat={item && item.type === "Hat"}
            class:smoked
        >
            {#if smoked}
                <!-- Smoke bubbles -->
                <div class="smoke"></div>
                <div class="smoke"></div>
                <div class="smoke"></div>
            {/if}

            {#if tint}
                <div
                    class="overlay"
                    style:--w={`${w}px`}
                    style:--h={`${h}px`}
                    style:--z={zoom}
                    style:--x={`${overlayX}px`}
                    style:--y={`${overlayY}px`}
                    style:--sprite={spritesheet}
                    style:--tint={tint}
                ></div>
            {/if}
        </div>
    {:else}
        <div class="item">??</div>
    {/if}
{/if}

<style>
    .item {
        position: relative;
    }

    .item::before,
    .overlay::before {
        content: "";
        display: block;
        background-image: var(--sprite);
        background-position: left var(--x) top var(--y);
        image-rendering: pixelated;
        width: var(--w);
        height: var(--h);
        zoom: var(--z);
    }

    .overlay::before {
        position: absolute;
        top: 0;
        width: var(--w);
        height: var(--h);
        background-color: var(--tint);
        -webkit-mask-image: var(--sprite);
        mask-image: var(--sprite);
        -webkit-mask-position: left var(--x) top var(--y);
        mask-position: left var(--x) top var(--y);
        zoom: var(--z);
    }

    .item.hat::before {
        margin-top: 6px;
    }

    .item.smoked::before {
        filter: brightness(0.5);
    }

    @keyframes smoke {
        0% {
            transform: scale(0.5) translateY(0);
            opacity: 0;
        }
        15% {
            opacity: 1;
        }
        100% {
            transform: scale(1.5) translateY(-75%);
            opacity: 0;
        }
    }

    .smoke:nth-child(1) {
        top: 0;
        left: 33%;
        animation-delay: 1s;
    }

    .smoke:nth-child(2) {
        top: 33%;
        left: 66%;
        animation-delay: 2s;
    }

    .smoke:nth-child(3) {
        top: 33%;
        left: 0;
        animation-delay: 3s;
    }

    .smoke {
        position: absolute;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 100%;
        width: 33%;
        height: 33%;
        animation: smoke 3s infinite;
        opacity: 0;
    }

    .overlay::after {
        content: "";
        position: absolute;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: var(--tint);
        mask-image: var(--sprite);
        -webkit-mask-image: var(--sprite);
        mask-position: left var(--x) top var(--y);
        -webkit-mask-position: left var(--x) top var(--y);
        width: var(--w);
        height: var(--h);
        zoom: var(--z);
        mix-blend-mode: multiply;
    }
</style>
