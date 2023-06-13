<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { SaveGame } from '$lib/Upload';
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';

    // https://github.com/sveltejs/kit/issues/5434
    page.subscribe((p) => p.url.pathname === '/' && get(SaveGame) && goto('/inventory'));
</script>

<slot />
