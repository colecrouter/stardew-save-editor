<script lang="ts">
    import type { ParentIndex } from '$lib/ItemParentIndex';
    import type { ItemInformation } from '$types/items/1.6';
    import type { Item } from '$types/save/1.6';
    import './Item.css';
    import ItemSprite from './ItemSprite.svelte';

    export let item: Item | undefined;
    export let index: ParentIndex;
    export let selectedItem: Item | undefined;
    export let selectedIndex: ParentIndex;

    const handleClick = () => {
        selectedItem = item;
        selectedIndex = index;
    };
</script>

<div
    class="item-wrapper"
    on:click={handleClick}
    on:keydown={handleClick}
    role="radio"
    aria-checked={index === selectedIndex}
    tabindex="0">
    <ItemSprite {item} />
</div>
