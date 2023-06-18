<script lang="ts">
    export let value: boolean;
</script>

<div class:disabled={!value} on:click={() => (value = !value)}>
    <slot />
</div>

<style>
    div {
        font-size: 2em;
        cursor: pointer;
        text-shadow: -2px 2px 2px #000;
    }

    div:hover {
        opacity: 0.8 !important;
    }

    div.disabled {
        opacity: 0.4;
    }
</style>
