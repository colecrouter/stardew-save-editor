<script lang="ts">
	import { untrack } from "svelte";

	import AtlasRegion from "./AtlasRegion.svelte";
	import {
		getUiAssets,
		uiIconAtlases,
		type UiIconName,
		uiIcons,
	} from "./uiAssets";

	let {
		name,
		label,
		size = 32,
	}: { name: UiIconName; label?: string; size?: number } = $props();
	const assets = untrack(getUiAssets);
	const rect = $derived(uiIcons[name]);
	const scale = $derived(size / Math.max(rect.width, rect.height));
</script>

<span
	class="icon"
	role={label ? "img" : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : true}
	style:width={`${rect.width * scale}px`}
	style:height={`${rect.height * scale}px`}
>
	<AtlasRegion atlas={assets[uiIconAtlases[name]]} {rect} />
</span>

<style>
	.icon {
		display: inline-block;
		flex: none;
		vertical-align: middle;
	}
</style>
