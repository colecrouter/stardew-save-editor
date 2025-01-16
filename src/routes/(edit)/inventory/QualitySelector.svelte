<script lang="ts" module>
    const qualityLevels = new Map([
        [0, "Normal"],
        [1, "Silver"],
        [2, "Gold"],
        [4, "Iridium"],
    ]);
</script>

<script lang="ts">
    import { calculatePrice, calculateEdibility } from "$lib/ItemQuality";

    import type { Item } from "$lib/proxies/Item";

    interface Props {
        item: Item;
    }

    let { item = $bindable() }: Props = $props();

    /** Update an item's quality, and recalculate its price & edibility */
    const updateQuality = (newQuality: number) => {
        item.quality = newQuality;

        if (item.info?.price !== undefined) {
            item.price = calculatePrice(item.info.price, newQuality);
        }

        if (item.info?.edibility !== undefined) {
            item.edibility = calculateEdibility(
                item.info.edibility,
                newQuality,
            );
        }
    };
</script>

<div class="container">
    <!-- Create 4 buttons containing star emoji-->
    {#if item.quality !== undefined}
        {#each qualityLevels as [i]}
            <label>
                {#if i === 0}
                    ☆
                {:else}
                    ⭐
                {/if}
                <input
                    type="radio"
                    checked={item.quality === i}
                    value={i}
                    bind:group={item.quality}
                    onclick={() => updateQuality(i)}
                    data-testid={`quality-${i}`}
                />
            </label>
        {/each}
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: row;
        align-items: center;
    }

    input[type="radio"] {
        appearance: none;
        width: 0;
        position: relative;
        display: inline;
    }

    label {
        cursor: pointer;
        user-select: none;
    }

    label:has(input:focus-within) {
        filter: drop-shadow(0 0 2px #000);
    }

    label input:checked::after {
        position: absolute;
        top: -0.75em;
        left: -1.25em;
        content: "✅";
        font-size: 0.8em;
    }

    label:nth-child(1) {
        font-size: 1.25em;
    }

    label:nth-child(2) {
        text-shadow:
            0 0 0 #dadfe5,
            0 0 2px #aaadb2;
        color: transparent;
    }

    label:nth-child(3) {
        text-shadow:
            0 0 0 #ffff18,
            0 0 2px #cccc13;
        color: transparent;
    }

    label:nth-child(4) {
        text-shadow:
            0 0 0 #db67c4,
            0 0 2px #a74f96;
        color: transparent;
    }
</style>
