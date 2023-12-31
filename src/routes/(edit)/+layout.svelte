<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { FileName, SaveGame, Character, Download } from '$lib/SaveFile';
    import { get } from 'svelte/store';
    import type { LayoutData } from './$types';
    import { onDestroy, setContext } from 'svelte';
    import SidebarButton from '../SidebarButton.svelte';
    import Router from './Router.svelte';
    import { tooltip } from '$lib/Tooltip';
    import { browser } from '$app/environment';
    import { base } from '$app/paths';

    export let data: LayoutData;

    // If the save changes for whatever reason, go back to the main screen
    const unsub = page.subscribe(() => browser && get(SaveGame) == undefined && goto(base + '/'));
    onDestroy(() => unsub());

    // Set the context for the item data for components to use
    // TODO move this to a data load function for the inventory page
    setContext('itemData', data.itemData);

    // Go back to the upload page
    const cancel = () => {
        SaveGame.set(undefined);
        FileName.set(undefined);
        goto(base + '/');
    };

    // Download the save file
    const download = async () => {
        const save = get(SaveGame);
        const filename = get(FileName);
        if (!save || !filename) {
            console.error('Save or filename is undefined');
            return;
        }

        await Download(save, filename);
    };
</script>

<div class="outer-wrapper">
    <Router />
    <div class="inner-wrapper">
        <div class="content">
            <slot />
        </div>
        <div class="sidebar">
            <div use:tooltip aria-label="Exit"><SidebarButton on:click={() => cancel()}>❌</SidebarButton></div>
            <div use:tooltip aria-label="Save"><SidebarButton on:click={() => download()}>💾</SidebarButton></div>
            <div use:tooltip aria-label="Previous Character"><SidebarButton on:click={Character.prev}>⬅️</SidebarButton></div>
            <div use:tooltip aria-label="Next Character"><SidebarButton on:click={Character.next}>➡️</SidebarButton></div>
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
