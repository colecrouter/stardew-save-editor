<script lang="ts">
    import type { Item } from '$types/save/1.6';
    import './Item.css';
    import ItemSprite from './ItemSprite.svelte';

    export let item: Item | undefined;
</script>

<div class="item-wrapper">
    <ItemSprite {item} />
</div>

<style>
    .item-wrapper {
        zoom: 2;
    }

    .item-wrapper:hover::after {
        display: none;
    }
</style>
