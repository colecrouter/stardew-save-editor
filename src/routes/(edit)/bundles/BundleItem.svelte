<script lang="ts">
    import { Sprite } from "$lib/Sprite";
    import { Item } from "$lib/proxies/Item";
    import UiCheckbox from "$lib/ui/UICheckbox.svelte";
    import ItemSprite from "../inventory/ItemSprite.svelte";

    interface Props {
        itemId: number;
        quantity?: number;
        quality?: number;
        checked?: boolean;
    }

    let {
        itemId,
        quantity = 1,
        quality = 0,
        checked = $bindable(),
    }: Props = $props();

    const item = $derived(
        itemId > 0 ? Item.fromObjectKey(itemId.toString()) : undefined,
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
        <ItemSprite {item} />
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
        width: 8em;
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
