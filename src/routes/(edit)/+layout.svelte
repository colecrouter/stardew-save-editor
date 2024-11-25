<script lang="ts">
    import { goto } from "$app/navigation";
    import { base } from "$app/paths";
    import { saveManager } from "$lib/save.svelte";
    import UiButton from "$lib/ui/UIButton.svelte";
    import Router from "./Router.svelte";
    interface Props {
        children: import("svelte").Snippet;
    }

    let { children }: Props = $props();

    // If the save changes for whatever reason, go back to the main screen
    const save = saveManager.save;
    if (!save) {
        goto(`${base}/`);
    }

    // Go back to the upload page
    const cancel = () => {
        if (!save) return;
        save.raw = undefined;
        goto(`${base}/`);
    };

    // Download the save file
    const download = async () => {
        await saveManager.download();
    };
</script>

<div class="outer-wrapper">
    <Router />
    <div class="inner-wrapper">
        <div class="content">
            {@render children()}
        </div>
        <div class="sidebar">
            <UiButton
                onclick={() => cancel()}
                alt="Exit"
                data-testid="cancel-button"
            >
                ❌
            </UiButton>
            <UiButton
                onclick={() => download()}
                alt="Save"
                data-testid="save-button"
            >
                💾
            </UiButton>
            <UiButton
                alt="Previous Character"
                onclick={() => save?.prevFarmer()}>⬅️</UiButton
            >
            <UiButton alt="Next Character" onclick={() => save?.nextFarmer()}
                >➡️</UiButton
            >
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
        width: 500px;
    }
</style>
