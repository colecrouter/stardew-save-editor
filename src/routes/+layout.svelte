<script lang="ts">
    import { setContext } from 'svelte';
</script>

<main>
    <slot />
</main>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        font-family: sans-serif;
        font-size: 16px;
        background-image: url(/wallpaper.jpg);
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
        image-rendering: pixelated;
    }

    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: start;
        padding-top: 5rem;
    }

    :global(code) {
        background-color: #555;
        color: #fff;
        padding: 0.2em 0.4em;
        border-radius: 0.3em;
        font-size: 85%;
    }
</style>
