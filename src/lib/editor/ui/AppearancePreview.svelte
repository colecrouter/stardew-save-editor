<script lang="ts">
	import { asset } from "$app/paths";
	import { appearanceLayers } from "../appearance-preview.ts";
	interface Props {
		appearance?: Record<string, unknown>;
	}
	let { appearance }: Props = $props();
	const drawing = $derived(appearanceLayers(appearance));
</script>

<div class="preview" role="img" aria-label="Character appearance preview">
	<!-- The stage reserves scaled layout space; layer offsets stay in source
	     pixels, including room above the head and below the pants. -->
	<div class="stage">
		<div class="figure" class:female={drawing.gender === "female"}>
			{#each drawing.layers as layer, index (index)}
				<div
					class={layer.part}
					style:--sheet={`url(${asset(layer.sheet)})`}
					style:--x={`${layer.x}px`}
					style:--y={`${layer.y}px`}
					style:--tint={layer.tint
						? `rgba(${layer.tint[0]},${layer.tint[1]},${layer.tint[2]},${(layer.tint[3] ?? 255) / 255})`
						: undefined}
				></div>
			{/each}
		</div>
	</div>
</div>
{#if drawing.notice}<p role="status">{drawing.notice}</p>{/if}

<style>
	.preview {
		display: grid;
		place-items: center;
		min-height: 260px;
		padding: 24px;
		background: linear-gradient(#8fc4d2, #d8eab1);
		border: 4px solid #8e3d04;
		image-rendering: pixelated;
	}
	.stage {
		/* Match the transformed 20 × 36 source-pixel canvas at fivefold scale. */
		width: 100px;
		height: 180px;
	}
	.figure {
		position: relative;
		width: 20px;
		height: 36px;
		transform: scale(5);
		transform-origin: top left;
	}
	.figure > :where(div) {
		position: absolute;
		width: 16px;
		height: 32px;
		/* Two source pixels leave room for hats extending above/left of the body. */
		top: 2px;
		left: 2px;
		background-image: var(--sheet);
		background-position: left var(--x) top var(--y);
	}
	.figure > div::after {
		content: "";
		position: absolute;
		inset: 0;
		background: var(--tint);
		mask-image: var(--sheet);
		mask-position: left var(--x) top var(--y);
	}
	.pants {
		/* The standing pants frame overlays the body, not the inventory icon. */
		top: 2px;
	}
	.shirt {
		height: 8px !important;
		width: 8px !important;
		top: 17px;
		left: 6px;
	}
	.hair,
	.accessory {
		height: 16px !important;
		top: 4px;
	}
	.hair {
		top: 2px;
	}
	.hat {
		height: 16px !important;
		width: 20px !important;
		top: 0;
		left: 0;
	}
	.pants::after,
	.shirt::after,
	.hair::after,
	.accessory::after {
		mix-blend-mode: multiply;
	}
	.female .hat {
		top: 1px;
	}
	.female .accessory {
		top: 5px;
	}
	.female .shirt {
		top: 18px;
	}
	.female .hair {
		top: 4px;
	}
	p {
		font-size: 17px;
	}
</style>
