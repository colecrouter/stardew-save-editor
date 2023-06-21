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
        text-shadow: -0.05em 0.05em 0 rgba(0, 0, 0, 0.2);
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

    :global(h1, h2, h3, h4, h5) {
        margin: 0;
        margin-bottom: 8px;
        padding: 0 8px;
    }

    :global(h3) {
        border-bottom: solid 2px #5b2b2a;
    }

    :global(.tooltip) {
        white-space: nowrap;
        position: relative;
    }

    :global(#tooltip) {
        position: absolute;
        bottom: 120%;
        right: 1rem;
        transform: translate(50%, 0);
        padding: 0.2rem 0.35rem;
        background: hsl(0, 0%, 20%);
        color: hsl(0, 0%, 98%);
        font-size: 0.95em;
        border-radius: 0.25rem;
        filter: drop-shadow(0 1px 2px hsla(0, 0%, 0%, 0.2));
        width: max-content;
    }

    :global(.tooltip:not(:focus) #tooltip::before) {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        width: 0.6em;
        height: 0.25em;
        background: inherit;
        clip-path: polygon(0% 0%, 100% 0%, 50% 100%);
    }
</style>
