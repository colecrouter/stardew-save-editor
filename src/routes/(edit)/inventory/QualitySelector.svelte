<script lang="ts" module>
    const qualityLevels = new Map([
        [0, "Normal"],
        [1, "Silver"],
        [2, "Gold"],
        [4, "Iridium"],
    ]);
</script>

<script lang="ts">
    import { CalculateEdibility, CalculatePrice } from "$lib/ItemQuality";
    import type { Item } from "$lib/proxies/Item";

    interface Props {
        item: Item;
    }

    let { item = $bindable() }: Props = $props();

    const changeQuality = (newQuality: number) => {
        item.quality = newQuality;
    };

    const changePrice = (newQuality: number) => {
        if (!("price" in item.info) || item.info.price === undefined) return;

        item.price = CalculatePrice(item.info.price, newQuality);
    };

    const changeEdibility = (newQuality: number) => {
        if (!("edibility" in item.info) || item.info.edibility === undefined)
            return;

        item.edibility = CalculateEdibility(item.info.edibility, newQuality);
    };
</script>

<div class="container">
    <!-- Create 4 buttons containing star emoji-->
    {#if item.quality !== undefined}
        {#each qualityLevels as [i]}
            <label data-testid={`quality-${i}`}>
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
                    onclick={() => (
                        changeQuality(i), changePrice(i), changeEdibility(i)
                    )}
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

    .container label {
        cursor: pointer;
        user-select: none;
    }

    .container label input:checked::after {
        position: absolute;
        top: -0.75em;
        left: -1.25em;
        content: "✅";
        font-size: 0.8em;
    }

    .container label:nth-child(1) {
        font-size: 1.25em;
    }

    .container label:nth-child(2) {
        text-shadow:
            0 0 0 #dadfe5,
            0 0 2px #aaadb2;
        color: transparent;
    }

    .container label:nth-child(3) {
        text-shadow:
            0 0 0 #ffff18,
            0 0 2px #cccc13;
        color: transparent;
    }

    .container label:nth-child(4) {
        text-shadow:
            0 0 0 #db67c4,
            0 0 2px #a74f96;
        color: transparent;
    }
</style>
