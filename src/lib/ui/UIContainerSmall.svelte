<script lang="ts">
    import Tooltip from "$lib/ui/Tooltip.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        [key: string]: unknown;
    }

    let { children, ...props }: Props = $props();
</script>

<div class="outer">
    <div class="container" {...props}>
        {@render children()}
    </div>
</div>

<style>
    .container {
        position: relative;
        border-radius: 2px;
        background-color: #ffc677;
    }

    .container::before {
        content: "";
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        border-radius: 2px;
        box-shadow:
            0 0 0 2px #b14e05,
            0 0 0 4px #dc7b05,
            0 0 0 6px #5b2b29;
    }

    .outer {
        display: inline-block;
        padding: 4px;
    }
</style>
