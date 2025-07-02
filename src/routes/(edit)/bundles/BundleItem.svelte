<script lang="ts">
    import { Sprite } from "$lib/Sprite.svelte";
    import { Item } from "$lib/proxies/Item.svelte";
    import UiCheckbox from "$lib/ui/UICheckbox.svelte";
    import ItemSprite from "../inventory/ItemSprite.svelte";

    interface Props {
        itemId: number;
        type: "O" | "BO" | "F" | "H" | "C" | "R";
        quantity?: number;
        quality?: number;
        checked?: boolean;
    }

    let {
        itemId,
        type,
        quantity = 1,
        quality = 0,
        checked = $bindable(),
    }: Props = $props();

    let matchedType = $derived.by(() => {
        switch (type) {
            case "O":
                return "Object";
            case "BO":
                return "BigCraftable";
            case "F":
                return "Furniture";
            case "H":
                return "Hat";
            case "C":
                return "Clothing";
            case "R":
                return "Object";
            default:
                throw new Error(`Unknown item type: ${type}`);
        }
    });

    const item = $derived(
        itemId > 0 ? Item.fromKey(itemId.toString(), matchedType) : undefined,
    );
</script>

<div class="row">
    <div class="item">
        {#if item}
            <ItemSprite {item} />
            <span>{item.name}</span>
        {:else}
            <div class="gold"></div>
            <span
                >{quantity}
                <div hidden>gold</div></span
            >
        {/if}
    </div>

    {#if checked !== undefined}
        <UiCheckbox bind:checked />
    {/if}
</div>

<style>
    .row {
        align-items: center;
        padding: 4px;
        border-bottom: 1px solid #0004;
        font-size: 0.8rem;
        width: 96px;
        text-align: center;
    }

    .item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .gold {
        background-image: url(/assets/font_colored.png);
        width: 8px;
        height: 16px;
        zoom: 2;
        background-position: top 0px left -32px;
    }
</style>
