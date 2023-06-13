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
    <div class="inner-wrapper">
        <div class="content">
            <slot />
        </div>
        <div class="sidebar">
            <SidebarButton on:click={() => cancel()}>❌</SidebarButton>
            <SidebarButton>💾</SidebarButton>
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

    :global(input[type='text'], input[type='number']) {
        border: solid 2px;
        border-bottom-color: #ffe4a1;
        border-left-color: #ffe4a1;
        border-right-color: #d68f54;
        border-top-color: #d68f54;
        background-color: #ffc677;
    }

    :global(input[type='text']:focus, input[type='number']:focus) {
        outline: none;
    }
</style>
