<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { SaveGame } from '$lib/Upload';
    import { get } from 'svelte/store';
    import type { LayoutData } from './$types';
    import { setContext } from 'svelte';
    import SidebarButton from './SidebarButton.svelte';
    import Router from './Router.svelte';

    page.subscribe(() => get(SaveGame) == undefined && goto('/'));

    export let data: LayoutData;
    setContext('itemData', data.itemData);

    const cancel = () => {
        SaveGame.set(undefined);
        goto('/');
    };
</script>

<div class="outer-wrapper">
    <Router />
    <div class="wrapper">
        <slot />
        <div class="sidebar">
            <SidebarButton on:click={() => cancel()}>❌</SidebarButton>
            <SidebarButton>💾</SidebarButton>
        </div>
    </div>
</div>

<style>
    .wrapper {
        display: flex;
        flex-direction: row;
        gap: 8px;
    }
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
</style>
