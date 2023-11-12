<script lang="ts">
    import { base } from '$app/paths';
</script>

<svelte:head>
    <link rel="icon" type="image/png" href="https://stardewcommunitywiki.com/mediawiki/images/3/33/Stardew_Checkup_Icon.png" />
    <title>Stardew Valley Save Editor</title>
    <meta name="description" content="A save editor for Stardew Valley" />

    <meta property="og:title" content="Stardew Valley Save Editor" />
    <meta property="og:description" content="A save editor for Stardew Valley" />
    <meta property="og:image" content={`${base}/wallpaper.jpg`} />
</svelte:head>

<!-- GITHUB LOGO -->
<a href="https://github.com/colecrouter/stardew-save-editor" aria-label="GitHub repository link" target="_blank" rel="noreferrer">
    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Octicons-mark-github.svg/600px-Octicons-mark-github.svg.png?20180806170715" alt="Github Logo" />
</a>

<main>
    <slot />
</main>

<!-- FOOTER -->
<small>Some assets utilized belong to ConcernedApe. Used under Fair Use and not affiliated with ConcernedApe or Stardew Valley</small>

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
        min-height: 100%;
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
        bottom: 100%;
        right: 1rem;
        transform: translate(50%, 0);
        padding: 0.2rem 0.35rem;
        background: hsl(0, 0%, 20%);
        color: hsl(0, 0%, 98%);
        font-size: 1rem;
        border-radius: 0.25rem;
        filter: drop-shadow(0 1px 2px hsla(0, 0%, 0%, 0.2));
        width: max-content;
        pointer-events: none;
        user-select: none;
    }

    :global(.tooltip:not(:focus) #tooltip::before) {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        width: 0.6rem;
        height: 0.25rem;
        background: inherit;
        clip-path: polygon(0% 0%, 100% 0%, 50% 100%);
    }

    :global(input[type='text'], input[type='number']) {
        border-radius: 4px;
        border: solid 2px;
        border-bottom-color: #9c613b;
        border-left-color: #9c613b;
        border-right-color: #6f3b31;
        border-top-color: #6f3b31;
        background-color: #f9bb65;
        box-shadow: inset -2px 2px 0 #e38813, -2px 2px 1px rgba(0, 0, 0, 0.2);
    }

    :global(input[type='text']:focus, input[type='number']:focus) {
        outline: none;
    }

    :global(button) {
        border: none;
        background: none;
        font-size: 1.5rem;
        text-shadow: 0 0 2px #000;
        cursor: pointer;
    }

    :global(button:hover) {
        filter: brightness(1.2);
    }

    a {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1;
        padding: 0.5rem;
    }

    a > img {
        width: 2rem;
        height: 2rem;
        transition: filter 0.2s ease-in-out;
        image-rendering: auto !important;
        filter: invert(1);
    }

    a::before {
        /* top right wedge */
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        height: 160%;
        width: 160%;
        background: #0008;
        clip-path: polygon(0% 0%, 100% 100%, 100% 0%);
    }

    a:hover > img {
        filter: invert(0.8);
    }

    small {
        position: fixed;
        bottom: 0;
        left: 0;
        margin: 0.1rem;
    }
</style>
