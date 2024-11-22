<script lang="ts">
    import type { Item } from "$lib/proxies/Item";
    import "./Item.css";
    import ItemSprite from "./ItemSprite.svelte";

    interface Props {
        item: Item | undefined;
    }

    let { item = $bindable() }: Props = $props();
</script>

<div class="item-wrapper">
    <ItemSprite {item} />
</div>

<style>
    .item-wrapper {
        zoom: 2;
        box-sizing: content-box !important;
        pointer-events: none;
        touch-action: none;
    }
</style>
