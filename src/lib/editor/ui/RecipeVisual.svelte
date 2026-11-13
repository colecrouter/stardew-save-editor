<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	import type { RecipePresentation } from "../recipe-presentation.ts";
	import UnknownItemVisual from "./UnknownItemVisual.svelte";
	interface Props {
		sprite?: RecipePresentation["sprite"];
	}
	let { sprite }: Props = $props();
	// Both missing metadata and absent installed sheets use the unknown-item fallback.
	const sheetUrl = $derived(sprite ? dynamicAsset(sprite.sheet) : undefined);
	const scale = $derived(
		sprite ? 40 / Math.max(sprite.width, sprite.height) : 1,
	);
</script>

<div class="visual" aria-hidden="true">
	{#if sprite && sheetUrl}
		<svg width="40" height="40" viewBox={`0 0 ${40 / scale} ${40 / scale}`}>
			<svg
				x={(40 / scale - sprite.width) / 2}
				y={(40 / scale - sprite.height) / 2}
				width={sprite.width}
				height={sprite.height}
				viewBox={`${sprite.x} ${sprite.y} ${sprite.width} ${sprite.height}`}
			>
				<image
					href={sheetUrl}
					width={sprite.sheetWidth}
					height={sprite.sheetHeight}
				/>
			</svg>
		</svg>
	{:else}
		<UnknownItemVisual />
	{/if}
</div>

<style>
	.visual {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		flex: none;
		image-rendering: pixelated;
	}
</style>
