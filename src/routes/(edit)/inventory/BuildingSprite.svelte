<script lang="ts">
	import { asset } from "$app/paths";
	import buildings from "$generated/buildings.json";
	import { Raw } from "$lib/proxies";
	import type { Building } from "$lib/proxies/Building.svelte";

	interface Props {
		building?: Building;
	}

	let { building }: Props = $props();

	let buildingData = $derived(
		buildings.find((b) => b.name === building?.[Raw].buildingType),
	);

	// Use tile dimensions for zoom calculation (not pixel dimensions)
	// This gives reasonable zoom values: 1x-3x tiles -> zoom ~1, larger -> smaller zoom
	let tileW = $derived(buildingData?.size?.X ?? 1);
	let tileH = $derived(buildingData?.size?.Y ?? 1);
	let zoom = $derived(2 / Math.sqrt(tileW * tileH));

	// Derive texture from building name (matches game: Buildings/{buildingType})
	// Falls back to lowercase building name for files like "Stone Cabin"
	let spritesheet = $derived(() => {
		const type = building?.[Raw].buildingType;
		if (!type) return null;
		// Map building type to asset filename
		// Game uses "Buildings\\{type}" -> we use "buildings/{type}.png"
		return `buildings/${type}`;
	});

	// Use size from generated JSON (in tiles), convert to pixels (64px per tile)
	let w = $derived((buildingData?.size?.X ?? 1) * 32);
	let h = $derived((buildingData?.size?.Y ?? 1) * 32);

	// Sprite coordinates - default to 0,0 for now (would need per-building data for accuracy)
	// This is a safe fallback; actual games load this from BuildingData
	let x = $derived(0);
	let y = $derived(0);

	// Compute sprite URL for background
	let spriteUrl = $derived.by(() => {
		const sheet = spritesheet();
		return sheet ? `url("${asset(`assets/${sheet}.png`)}")` : "none";
	});
</script>

{#if building}
	{#if buildingData}
		<div
			class="item"
			style:--w={`${w}px`}
			style:--h={`${h}px`}
			style:--z={zoom}
			style:--x={`${x}px`}
			style:--y={`${y}px`}
			style:--sprite={spriteUrl}
		></div>
	{:else}
		<div class="item">??</div>
	{/if}
{/if}

<style>
	.item {
		content: "";
		display: block;
		background-image: var(--sprite);
		background-position: left var(--x) top var(--y);
		background-repeat: no-repeat;
		image-rendering: pixelated;
		width: var(--w);
		height: var(--h);
		zoom: var(--z);
	}
</style>
