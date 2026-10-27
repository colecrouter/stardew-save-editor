<script lang="ts">
	import { onDestroy, type Snippet } from "svelte";
	import { setSaveManager } from "$lib/SaveManager.svelte";
	let { children }: { children: Snippet } = $props();
	// Legacy proxy state is created only for legacy routes. Entering /v2 neither
	// restores development localStorage nor allocates a second writable session.
	const manager = setSaveManager();
	// Imported proxy roots outlive component effects unless explicitly reset.
	onDestroy(() => manager.reset());
</script>

{@render children()}
