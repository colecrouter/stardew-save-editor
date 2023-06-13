<script lang="ts">
    import SidebarButton from './SidebarButton.svelte';
</script>

<nav>
    <a href="/inventory"><SidebarButton>🎒</SidebarButton></a>
    <a href="/character"><SidebarButton>🪞</SidebarButton></a>
    <a href="/relationships"><SidebarButton>💖</SidebarButton></a>
    <a href="/bundles"><SidebarButton>📦</SidebarButton></a>
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
