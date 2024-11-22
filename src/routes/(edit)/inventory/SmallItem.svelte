<script lang="ts">
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import type { Item } from "$lib/proxies/Item";
    import "./Item.css";
    import ItemSprite from "./ItemSprite.svelte";

    interface Props {
        item: Item | undefined;
        index: ParentIndex;
        selectedItem: Item | undefined;
        selectedIndex: ParentIndex;
    }

    let {
        item,
        index,
        selectedItem = $bindable(),
        selectedIndex = $bindable(),
    }: Props = $props();

    const handleClick = () => {
        selectedItem = item;
        selectedIndex = index;
    };
</script>

<div
    class="item-wrapper"
    onclick={handleClick}
    onkeydown={handleClick}
    class:active={index === selectedIndex}
    role="radio"
    aria-checked={index === selectedIndex}
    tabindex="0"
    data-testid={`item-${index}`}
>
    <ItemSprite {item} />
</div>

<style>
    .item-wrapper {
        box-sizing: content-box !important;
    }
</style>
