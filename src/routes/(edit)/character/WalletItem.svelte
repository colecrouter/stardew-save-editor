<script lang="ts">
    export let value: boolean;
</script>

<button class:disabled={!value} on:click={() => (value = !value)}>
    <slot />
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
