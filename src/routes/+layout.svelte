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
        border: solid 2px;
        border-bottom-color: #ffe4a1;
        border-left-color: #ffe4a1;
        border-right-color: #d68f54;
        border-top-color: #d68f54;
        background-color: #ffc677;
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
</style>
