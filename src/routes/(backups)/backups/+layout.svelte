<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { SaveGame } from '$lib/SaveFile';
    import { get } from 'svelte/store';
    import SidebarButton from '../../SidebarButton.svelte';
    import { tooltip } from '$lib/Tooltip';

    // https://github.com/sveltejs/kit/issues/5434
    page.subscribe((p) => p.url.pathname === '/' && get(SaveGame) && goto('/inventory'));
</script>

<div class="wrapper">
    <slot />

    <nav>
        <a href="/" aria-label="Cancel" use:tooltip>
            <SidebarButton>❌</SidebarButton>
        </a>
    </nav>
</div>

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
