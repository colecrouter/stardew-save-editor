<script lang="ts">
    import { base } from '$app/paths';
    import { tooltip } from '$lib/Tooltip';
    import SidebarButton from '../SidebarButton.svelte';
</script>

<nav>
    <a href={`${base}/inventory`} aria-label="Inventory" use:tooltip><SidebarButton>🎒</SidebarButton></a>
    <a href={`${base}/character`} aria-label="Character" use:tooltip><SidebarButton>🙋</SidebarButton></a>
    <a href={`${base}/appearance`} aria-label="Appearance" use:tooltip><SidebarButton>🪞</SidebarButton></a>
    <a href={`${base}/relationships`} aria-label="Relationships" use:tooltip><SidebarButton>💖</SidebarButton></a>
    <a href={`${base}/crafting`} aria-label="Crafting" use:tooltip><SidebarButton>🔨</SidebarButton></a>
    <a href={`${base}/cooking`} aria-label="Cooking" use:tooltip><SidebarButton>🍫</SidebarButton></a>
    <a href={`${base}/bundles`} aria-label="Community Center bundles" use:tooltip><SidebarButton>🎁</SidebarButton></a>
</nav>

<style>
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
