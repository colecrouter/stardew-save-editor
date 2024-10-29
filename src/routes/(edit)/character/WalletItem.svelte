<script lang="ts">
    interface Props {
        value: boolean;
        children?: import("svelte").Snippet;
    }

    let { value = $bindable(), children }: Props = $props();
</script>

<button class:disabled={!value} onclick={() => (value = !value)}>
    {@render children?.()}
</button>

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
