<script lang="ts">
	import LegacyLayout from "../../../src/routes/(legacy)/+layout.svelte";
	import type { SaveManager } from "../../../src/lib/SaveManager.svelte";
	import LegacyScopeProbe from "./LegacyScopeProbe.svelte";
	let { onready }: { onready: (manager: SaveManager) => void } = $props();
</script>

<LegacyLayout><LegacyScopeProbe {onready} /></LegacyLayout>
