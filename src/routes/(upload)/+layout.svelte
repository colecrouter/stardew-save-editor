<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { SaveGame } from '$lib/SaveFile';
    import { get } from 'svelte/store';
    import SidebarButton from '../SidebarButton.svelte';
    import { tooltip } from '$lib/Tooltip';
    import { browser } from '$app/environment';
    import { base } from '$app/paths';

    // https://github.com/sveltejs/kit/issues/5434
    page.subscribe((p) => browser && p.url.pathname === '/' && get(SaveGame) && goto(base + '/inventory'));
</script>

<div class="wrapper">
    <slot />

    <nav>
        <a href={`${base}/backups`} aria-label="Backups" use:tooltip>
            <SidebarButton>💿</SidebarButton>
        </a>
    </nav>
</div>

<!-- SEO data -->
<main hidden>
    <h1>Stardew Valley Save Editor</h1>
    <p>
        This is an online editor for the hit game <a href="https://stardewvalley.net/">Stardew Valley</a>. Upload your save file here, modify your it, then download your edited save file. Make sure to make a backup of your save file!
    </p>

    <nav>
        <h2>Inventory</h2>
        <h2>Character</h2>
        <h2>Appearance</h2>
        <h2>Relationships</h2>
        <h2>Crafting</h2>
        <h2>Cooking</h2>
    </nav>

    <h3>
        <a href="https://github.com/colecrouter/stardew-save-editor">Link to the GitHub project</a>
    </h3>
</main>

<style>
    .wrapper {
        display: flex;
        flex-direction: row;
        gap: 8px;
        justify-content: start;
    }

    nav {
        display: flex;
        flex-direction: row;
        gap: 8px;
        justify-content: start;
        padding: 2px;
    }

    a {
        text-decoration: none;
    }
</style>
