<script lang="ts">
	import type { Atlas, SpriteRect } from "./uiAssets";
	let { atlas, rect }: { atlas: Atlas; rect: SpriteRect } = $props();
</script>

<!-- A viewport clips one source region; the browser caches the shared atlas. -->
<svg
	aria-hidden="true"
	focusable="false"
	viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`}
	preserveAspectRatio="none"
>
	<image href={atlas.url} width={atlas.width} height={atlas.height} />
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: hidden;
		image-rendering: pixelated;
	}
</style>
