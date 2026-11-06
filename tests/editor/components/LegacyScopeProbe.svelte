<script lang="ts">
	import {
		getSaveManager,
		type SaveManager,
	} from "../../../src/lib/SaveManager.svelte";
	let { onready }: { onready: (manager: SaveManager) => void } = $props();
	const manager = getSaveManager();
	$effect(() => onready(manager));
</script>
