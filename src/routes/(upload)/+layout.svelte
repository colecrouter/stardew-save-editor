<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { get } from "svelte/store";
    import SidebarButton from "../SidebarButton.svelte";
    import { tooltip } from "$lib/Tooltip";
    import { browser } from "$app/environment";
    import { base } from "$app/paths";
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
