<script lang="ts">
	import { asset } from "$app/paths";

	import { readBuildingSprite } from "./building-sprite.ts";

	interface Props {
		/** Domain views and legacy proxies share this small presentation contract. */
		building?: {
			readonly name: string | undefined;
			readonly repaired?: boolean | undefined;
		};
		/** The square stays reserved while the selected building changes. */
		size?: number;
	}

	let { building, size = 64 }: Props = $props();
	const frameSize = $derived(Number.isFinite(size) && size > 0 ? size : 64);
	const sprite = $derived(
		readBuildingSprite(building?.name, building?.repaired),
	);
	const width = $derived(sprite?.width);
	const height = $derived(sprite?.height);
	const scale = $derived(frameSize / Math.max(width ?? 1, height ?? 1));
	// Negative offsets move the chosen source pixels into the crop. Sprite and
	// scenery URLs both include the deployment base, including GitHub Pages paths.
	const spriteUrl = $derived(sprite ? `url("${sprite.url}")` : "none");
	const sceneryUrl = `url("${asset("assets/daybg.png")}")`;
</script>

{#if building}
	<!-- Adjacent text names each building; the thumbnail is decorative. Absolute
	     source geometry keeps flex/grid layouts from shrinking or stretching it. -->
	<div
		class="wrapper"
		aria-hidden="true"
		style:--size={`${frameSize}px`}
		style:--scenery={sceneryUrl}
	>
		<div class="clip">
			{#if sprite}
				<div
					class="item"
					style:width={`${width}px`}
					style:height={`${height}px`}
					style:left={`${(frameSize - (width ?? 1) * scale) / 2}px`}
					style:top={`${(frameSize - (height ?? 1) * scale) / 2}px`}
					style:--scale={scale}
					style:--x={`${-sprite.x}px`}
					style:--y={`${-sprite.y}px`}
					style:--sprite={spriteUrl}
				></div>
			{:else}
				<span class="fallback" title="Preview unavailable">?</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.wrapper {
		position: relative;
		flex: 0 0 var(--size);
		width: var(--size);
		height: var(--size);
		margin: 6px;
	}
	.clip {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: 2px;
		background-image: var(--scenery);
		background-size: 180% auto;
		background-position: center 56%;
	}
	.wrapper::after {
		content: "";
		position: absolute;
		inset: 0;
		box-shadow:
			0 0 0 2px #8e3d04,
			0 0 0 4px #d97804,
			0 0 0 6px #5b2b29;
		border-radius: 2px;
		pointer-events: none;
	}
	.item {
		position: absolute;
		background-image: var(--sprite);
		background-position: var(--x) var(--y);
		background-repeat: no-repeat;
		image-rendering: pixelated;
		transform: scale(var(--scale));
		transform-origin: top left;
	}
	.fallback {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: #5b2b29;
		font-size: 28px;
		background: #f5dda8;
	}
</style>
