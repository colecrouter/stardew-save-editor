<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { base } from "$app/paths";
    import { page } from "$app/stores";
    import { tooltip } from "$lib/Tooltip";
    import { saveManager } from "$lib/save.svelte";
    import SidebarButton from "../../SidebarButton.svelte";
    interface Props {
        children?: import("svelte").Snippet;
    }

    let { children }: Props = $props();

    // https://github.com/sveltejs/kit/issues/5434
    page.subscribe(
        (p) =>
            browser &&
            p.url.pathname === "/" &&
            saveManager.save?.raw &&
            goto(`${base}/inventory`),
    );
</script>

<div class="wrapper">
    {@render children?.()}

    <nav>
        <a href={`${base}/`} aria-label="Cancel" use:tooltip>
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
