<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import AtlasRegion from "./AtlasRegion.svelte";
	import { dialogueFrame, getUiAssets } from "./uiAssets";
	let { children, enabled = true }: { children: Snippet; enabled?: boolean } =
		$props();
	const assets = untrack(getUiAssets);
</script>

<div class={{ framed: enabled }}>
	{#if enabled}
		<div class="decoration" aria-hidden="true">
			{#each dialogueFrame as tile (tile.part)}
				<div class={`tile ${tile.part}`}>
					<AtlasRegion atlas={assets.menu} rect={tile} />
				</div>
			{/each}
		</div>
	{/if}
	<div class="content">{@render children()}</div>
</div>

<style>
	.framed {
		position: relative;
		isolation: isolate;
		--frame-corner: 64px;
		--frame-fill: 28px;
		padding: 48px;
		min-width: 128px;
		min-height: 128px;
		color: #4e240f;
	}
	.decoration {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
	}
	.tile {
		position: absolute;
	}
	.center {
		inset: var(--frame-fill);
	}
	.top-left,
	.top-right,
	.bottom-left,
	.bottom-right {
		width: var(--frame-corner);
		height: var(--frame-corner);
	}
	.top-left {
		left: 0;
		top: 0;
	}
	.top-right {
		right: 0;
		top: 0;
	}
	.bottom-left {
		left: 0;
		bottom: 0;
	}
	.bottom-right {
		right: 0;
		bottom: 0;
	}
	.top,
	.bottom {
		left: var(--frame-corner);
		right: var(--frame-corner);
		height: var(--frame-corner);
	}
	.top {
		top: 0;
	}
	.bottom {
		bottom: 0;
	}
	.left,
	.right {
		top: var(--frame-corner);
		bottom: var(--frame-corner);
		width: var(--frame-corner);
	}
	.left {
		left: 0;
	}
	.right {
		right: 0;
	}
	.content {
		min-width: 0;
	}
	@media (max-width: 480px) {
		.framed {
			/* MenuTiles expands the source pixel art fourfold. Half-size tiles
			   retain a twofold pixel-art scale while leaving room for controls. */
			--frame-corner: 32px;
			--frame-fill: 14px;
			padding: 24px;
		}
	}
</style>
