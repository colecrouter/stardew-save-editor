<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	import type { ItemVisual } from "../item-presentation.ts";
	import UnknownItemVisual from "./UnknownItemVisual.svelte";
	import QualityBadge from "./QualityBadge.svelte";

	interface Props {
		visual?: ItemVisual;
		/** Maximum drawing dimension; preserve the sprite's aspect ratio. */
		size?: number;
	}
	let { visual: drawing, size = 32 }: Props = $props();
	const id = $props.id();
	// Missing sheets use the same unknown-item visual as unsupported catalog entries.
	const sheetUrl = $derived(
		drawing ? dynamicAsset(`assets/${drawing.sheet}`) : undefined,
	);
	// Domain drawing instructions already include instance-specific colors and
	// quality. Rendering only scales the projected rectangle and applies layers.
	const zoom = $derived(
		size /
			Math.max(
				drawing?.sourceRect.width ?? 16,
				drawing?.sourceRect.height ?? 16,
				16,
			),
	);
	function tintMatrix(channels: readonly number[]) {
		const [r, g, b, a] = channels.map((channel) => channel / 255);
		return `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 ${a} 0`;
	}
</script>

{#if drawing}
	<div
		class="visual"
		aria-hidden="true"
		style:width={`${drawing.sourceRect.width * zoom}px`}
		style:height={`${drawing.sourceRect.height * zoom}px`}
	>
		{#if sheetUrl}
			{#each drawing.layers as layer, index (index)}
				<svg
					width="100%"
					height="100%"
					viewBox={`${layer.rect.x} ${layer.rect.y} ${layer.rect.width} ${layer.rect.height}`}
				>
					{#if layer.tint}
						<defs>
							<filter
								id={`${id}-tint-${index}`}
								color-interpolation-filters="sRGB"
							>
								<feColorMatrix type="matrix" values={tintMatrix(layer.tint)} />
							</filter>
						</defs>
					{/if}
					<image
						href={sheetUrl}
						width={drawing.sheetSize.width}
						height={drawing.sheetSize.height}
						filter={layer.tint ? `url(#${id}-tint-${index})` : undefined}
					/>
				</svg>
			{/each}
		{:else}
			<!-- Keep known quality visible even when the catalog sheet is absent. -->
			<span class="fallback" style:width="100%" style:height="100%">
				<UnknownItemVisual />
			</span>
		{/if}
		<!-- Quality belongs to the saved instance; display only recognized tiers
		     without guessing at custom values or changing the preserved record. -->
		<span class="quality-badge">
			<QualityBadge quality={drawing.quality} />
		</span>
	</div>
{:else}
	<span class="fallback" style:width={`${size}px`} style:height={`${size}px`}>
		<UnknownItemVisual />
	</span>
{/if}

<style>
	.fallback {
		display: inline-block;
		flex: none;
	}
	.fallback :global(svg) {
		width: 100%;
		height: 100%;
	}
	.visual {
		position: relative;
		flex: none;
	}
	.quality-badge {
		position: absolute;
		left: -2px;
		bottom: -2px;
		line-height: 0;
	}
	svg {
		position: absolute;
		inset: 0;
		overflow: hidden;
		image-rendering: pixelated;
	}
</style>
