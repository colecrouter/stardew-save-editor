<script lang="ts">
    import { base } from "$app/paths";
    import { setSaveManager } from "$lib/SaveManager.svelte";
    import { setToastManager, Toast } from "$lib/ToastManager.svelte";
    import Toasts from "$lib/ui/Toasts.svelte";
    interface Props {
        children?: import("svelte").Snippet;
    }

    let { children }: Props = $props();

    const toastManager = setToastManager();
    const saveManager = setSaveManager();
    saveManager.init();
</script>

<svelte:head>
    <meta property="og:image" content={`${base}/img/summary.png`} />
    <link rel="icon" type="image/png" href={`${base}/img/favicon.png`} />
    <link rel="canonical" href={`${base}/backups`} />
    <link rel="canonical" href={`${base}/inventory`} />
    <link rel="canonical" href={`${base}/character`} />
    <link rel="canonical" href={`${base}/appearance`} />
    <link rel="canonical" href={`${base}/relationships`} />
    <link rel="canonical" href={`${base}/crafting`} />
    <link rel="canonical" href={`${base}/cooking`} />
</svelte:head>

<!-- GITHUB LOGO -->
<a
    href="https://github.com/colecrouter/stardew-save-editor"
    aria-label="GitHub repository link"
    target="_blank"
    rel="noreferrer"
>
    <img
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Octicons-mark-github.svg/600px-Octicons-mark-github.svg.png?20180806170715"
        alt="Github Logo"
    />
</a>

<main>
    {@render children?.()}
</main>

<Toasts />

<!-- FOOTER -->
<small>
    Some assets utilized belong to ConcernedApe. Used under Fair Use and not
    affiliated with ConcernedApe or Stardew Valley
</small>

<!-- SEO data -->
<footer hidden>
    <h1>Stardew Valley Save Editor</h1>

    <p>
        This is an online editor for the hit game <a
            href="https://stardewvalley.net/">Stardew Valley</a
        >. Upload your save file here, modify your it, then download your edited
        save file. Make sure to make a backup of your save file! With this too,
        you can change your appearance, inventory, skills, crafting recipes, and
        more. More features will be added in the future. If you find a problem,
        please report it
        <a href="https://github.com/colecrouter/stardew-save-editor/issues"
            >on GitHub</a
        >. PRs are welcome!
    </p>

    <nav>
        <h2><a href={`${base}/`}>Upload</a></h2>
        <h2><a href={`${base}/backups`}>Backups</a></h2>

        <h2><a href={`${base}/inventory`}>Inventory</a></h2>
        <h2><a href={`${base}/character`}>Character</a></h2>
        <h2><a href={`${base}/appearance`}>Appearance</a></h2>
        <h2><a href={`${base}/relationships`}>Relationships</a></h2>
        <h2><a href={`${base}/crafting`}>Crafting</a></h2>
        <h2><a href={`${base}/cooking`}>Cooking</a></h2>
    </nav>

    <h3>
        <a href="https://github.com/colecrouter/stardew-save-editor"
            >Link to the GitHub project</a
        >
    </h3>
</footer>

<style>
    @import "../root.css";

    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: start;
        padding-top: 5rem;
        min-height: 100%;
        padding-bottom: 4rem;
    }

    /* GitHub logo */
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
        content: "";
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
        position: absolute;
        bottom: 0;
        /* margin: 0.1rem; */
        z-index: -1;
        padding: 4px;
    }
</style>
