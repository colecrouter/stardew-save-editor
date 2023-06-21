<script lang="ts">
    import SidebarButton from './SidebarButton.svelte';
</script>

<nav>
    <a href="/inventory" aria-label="Inventory"><SidebarButton>🎒</SidebarButton></a>
    <a href="/character" aria-label="Character"><SidebarButton>🙋</SidebarButton></a>
    <a href="/relationships" aria-label="Relationships"><SidebarButton>💖</SidebarButton></a>
    <a href="/crafting" aria-label="Crafting"><SidebarButton>📏</SidebarButton></a>
    <a href="/cooking" aria-label="Cooking"><SidebarButton>🍕</SidebarButton></a>
    <a href="/bundles" aria-label="Community Center bundles"><SidebarButton>🎁</SidebarButton></a>
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
