<script lang="ts">
    import type { Snippet } from "svelte";
    import type { MouseEventHandler } from "svelte/elements";
    import Page from "./(upload)/+page.svelte";

    interface Props {
        children?: Snippet;
        onclick?: MouseEventHandler<HTMLButtonElement>;
    }

    let { children, onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<button {onclick}>
    {@render children?.()}
</button>

<style>
    button {
        all: unset;
        background-color: #ffc677;
        border-radius: 2px;
        box-shadow:
            0 0 0 2px #b14e05,
            0 0 0 4px #dc7b05,
            0 0 0 6px #5b2b29;
        width: fit-content;
        height: fit-content;
        margin: 6px;
        cursor: pointer;
        text-shadow: 0 0 2px #000;
        user-select: none;
    }

    button:hover {
        outline: revert;
    }
</style>
