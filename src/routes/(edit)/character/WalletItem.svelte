<script lang="ts">
    import Tooltip from "$lib/ui/Tooltip.svelte";

    interface Props {
        value?: boolean;
        alt: string;
        children?: import("svelte").Snippet;
        [key: string]: unknown;
    }

    let { value = $bindable(false), alt, children, ...props }: Props = $props();
</script>

<Tooltip text={alt}>
    <button class:disabled={!value} onclick={() => (value = !value)} {...props}>
        {@render children?.()}
    </button>
</Tooltip>

<style>
    button {
        all: unset;
        font-size: 2em;
        cursor: pointer;
        text-shadow: -2px 2px 2px #000;
    }

    button:hover {
        outline: revert;
        opacity: 0.8 !important;
    }

    button.disabled {
        opacity: 0.4;
    }
</style>
