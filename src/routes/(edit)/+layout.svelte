<script lang="ts">
    import { goto } from "$app/navigation";
    import { base } from "$app/paths";
    import { saveManager } from "$lib/save.svelte";
    import { tooltip } from "$lib/Tooltip";
    import SidebarButton from "../SidebarButton.svelte";
    import Router from "./Router.svelte";
    interface Props {
        children: import("svelte").Snippet;
    }

    let { children }: Props = $props();

    // If the save changes for whatever reason, go back to the main screen
    const save = saveManager.save;
    if (!save) {
        goto(base + "/");
    }

    // Go back to the upload page
    const cancel = () => {
        if (!save) return;
        save.raw = undefined;
        goto(base + "/");
    };

    // Download the save file
    const download = async () => {
        await saveManager.export();
    };
</script>

<div class="outer-wrapper">
    <Router />
    <div class="inner-wrapper">
        <div class="content">
            {@render children()}
        </div>
        <div class="sidebar">
            <div use:tooltip aria-label="Exit">
                <SidebarButton onclick={() => cancel()}>❌</SidebarButton>
            </div>
            <div use:tooltip aria-label="Save">
                <SidebarButton onclick={() => download()}>💾</SidebarButton>
            </div>
            <div use:tooltip aria-label="Previous Character">
                <SidebarButton onclick={save?.prevFarmer}>⬅️</SidebarButton>
            </div>
            <div use:tooltip aria-label="Next Character">
                <SidebarButton onclick={save?.nextFarmer}>➡️</SidebarButton>
            </div>
        </div>
    </div>
</div>

<style>
    .sidebar {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .outer-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .inner-wrapper {
        display: flex;
        flex-direction: row;
        gap: 8px;
    }

    .content {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
</style>
