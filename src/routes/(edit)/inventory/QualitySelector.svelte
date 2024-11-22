<script lang="ts">
    import { ItemData } from "$lib/ItemData";
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
        const data = ItemData.get(item.name);
        if (!data || !("Price" in data) || data.Price === undefined) return;

        item.price = CalculatePrice(data.Price, newQuality);
    };

    const changeEdibility = (newQuality: number) => {
        const data = ItemData.get(item.name);
        if (!data || !("Edibility" in data)) return;

        item.edibility = CalculateEdibility(data.Edibility, newQuality);
    };
</script>

<div class="container">
    <!-- Create 4 button containing star emoji-->
    {#if "quality" in item}
        {#each [0, 1, 2, 4] as i}
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
