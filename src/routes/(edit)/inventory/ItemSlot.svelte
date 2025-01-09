<script lang="ts">
    import type { Snippet } from "svelte";
    import type { HTMLButtonAttributes } from "svelte/elements";

    type Props = HTMLButtonAttributes & {
        children: Snippet;
        active?: boolean;
    };

    let { children, active, ...rest }: Props = $props();
</script>

<button class="item-wrapper" class:active {...rest}>
    {@render children()}
</button>

<style>
    .item-wrapper {
        all: unset;
        box-sizing: content-box;
        display: block;
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
        width: 32px;
        height: 32px;
        position: absolute;
        cursor: pointer;
    }

    .item-wrapper.active::before {
        content: "";
        background-color: rgba(255, 255, 255, 0.5);
    }

    .item-wrapper:focus-within:not(.active)::before {
        content: "";
        background-color: #00000020;
    }
</style>
