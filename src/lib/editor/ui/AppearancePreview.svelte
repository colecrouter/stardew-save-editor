<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	import type { AppearancePreviewView } from "../appearance-preview.ts";
	interface Props {
		preview: AppearancePreviewView;
	}
	let { preview }: Props = $props();
</script>

<div class="preview" role="img" aria-label="Character appearance preview">
	<!-- The stage reserves scaled layout space; layer offsets stay in source
	     pixels, including room above the head and below the pants. -->
	<div class="stage">
		<div class="figure" class:female={preview.gender === "female"}>
			<!-- Missing catalog sheets leave their layer absent rather than requesting a guessed URL. -->
			{#each preview.layers as layer, index (index)}
				{@const sheetUrl = dynamicAsset(layer.sheet)}

				{#if sheetUrl}
					<div
						class={layer.part}
						style:--sheet={`url("${sheetUrl}")`}
						style:--x={`${layer.x}px`}
						style:--y={`${layer.y}px`}
						style:--tint={layer.tint
							? `rgba(${layer.tint[0]},${layer.tint[1]},${layer.tint[2]},${(layer.tint[3] ?? 255) / 255})`
							: undefined}
					></div>
				{/if}
			{/each}
		</div>
	</div>
</div>
{#if preview.notice}
	<p class="notice">{preview.notice}</p>
{/if}

<style>
	.preview {
		display: grid;
		place-items: center;
		min-height: 260px;
		padding: 24px;
		/* The pale diagonal reflection distinguishes the dresser's mirror from
		   an outdoor scene; the reserved stage still owns all sprite geometry. */
		background: linear-gradient(
			135deg,
			#d9e9df 0 46%,
			#f2f5e8 46% 51%,
			#d9e9df 51% 100%
		);
		border: 2px solid #a57542;
		box-shadow: inset 0 0 0 4px #f0d3a1;
		image-rendering: pixelated;
	}
	.stage {
		/* Reserve the full source canvas at the chosen scale, including hat/feet
		   space. Compact roster previews share the same sprite geometry. */
		width: calc(20px * var(--appearance-scale, 5));
		height: calc(36px * var(--appearance-scale, 5));
	}
	.figure {
		position: relative;
		width: 20px;
		height: 36px;
		transform: scale(var(--appearance-scale, 5));
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
