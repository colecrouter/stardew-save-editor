<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        active?: boolean;
        [key: string]: unknown;
    }

    let { children, active, ...rest }: Props = $props();
</script>

<div class="item-wrapper" class:active {...rest}>
    {@render children()}
</div>

<style>
    .item-wrapper {
        box-sizing: content-box !important;
    }

    .item-wrapper {
        position: relative;
        border: solid 2px;
        border-bottom-color: #ffe4a1;
        border-left-color: #ffe4a1;
        border-right-color: #d68f54;
        border-top-color: #d68f54;
        height: 32px;
        width: 32px;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .item-wrapper::before {
        content: "";
        width: 36px;
        height: 36px;
        position: absolute;
        top: -2px;
        left: -2px;
        cursor: pointer;
    }

    .item-wrapper.active::before {
        content: "";
        background-color: rgba(255, 255, 255, 0.5);
    }
</style>
