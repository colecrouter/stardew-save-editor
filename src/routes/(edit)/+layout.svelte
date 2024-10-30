<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { base } from "$app/paths";
    import { page } from "$app/stores";
    import { saveManager } from "$lib/SaveFile.svelte";
    import { tooltip } from "$lib/Tooltip";
    import { onDestroy } from "svelte";
    import SidebarButton from "../SidebarButton.svelte";
    import Router from "./Router.svelte";
    interface Props {
        children: import("svelte").Snippet;
    }

    let { children }: Props = $props();

    // If the save changes for whatever reason, go back to the main screen
    if (!saveManager.saveData) {
        goto(base + "/");
    }

    // Go back to the upload page
    const cancel = () => {
        saveManager.saveData = undefined;
        goto(base + "/");
    };

    // Download the save file
    const download = async () => {
        await saveManager.download("todo");
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
                <SidebarButton onclick={saveManager.prevFarmer}
                    >⬅️</SidebarButton
                >
            </div>
            <div use:tooltip aria-label="Next Character">
                <SidebarButton onclick={saveManager.nextFarmer}
                    >➡️</SidebarButton
                >
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
