<script lang="ts">
	import { untrack } from "svelte";
	import AtlasRegion from "./AtlasRegion.svelte";
	import { getUiAssets, uiIcons, type UiIconName } from "./uiAssets";
	let {
		name,
		label,
		scale = 2,
	}: { name: UiIconName; label?: string; scale?: 1 | 2 | 3 } = $props();
	const assets = untrack(getUiAssets);
	const rect = $derived(uiIcons[name]);
</script>

<span
	class="icon"
	role={label ? "img" : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : true}
	style:width={`${rect.width * scale}px`}
	style:height={`${rect.height * scale}px`}
>
	<AtlasRegion atlas={assets.cursors} {rect} />
</span>

<style>
	.icon {
		display: inline-block;
		flex: none;
		vertical-align: middle;
	}
</style>
