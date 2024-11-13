<script lang="ts">
    import { base } from "$app/paths";
    import { tooltip } from "$lib/Tooltip";
    import SidebarButton from "../SidebarButton.svelte";
    interface Props {
        children: import("svelte").Snippet;
    }

    let { children }: Props = $props();
</script>

<div class="wrapper">
    {@render children()}

    <nav>
        <a href={`${base}/backups`} aria-label="Backups" use:tooltip>
            <SidebarButton>💿</SidebarButton>
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
