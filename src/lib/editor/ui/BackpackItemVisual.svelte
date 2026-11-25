<script lang="ts">
	import { asset } from "$app/paths";
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	import { uiAtlases } from "$lib/ui/uiAssets.ts";

	import type { ItemVisual } from "../item-presentation.ts";
	import QualityBadge from "./QualityBadge.svelte";
	import UnknownItemVisual from "./UnknownItemVisual.svelte";

	interface Props {
		// An unavailable drawing is an explicit renderer state, including reactive resets.
		visual?: ItemVisual | undefined;
		/** Maximum drawing dimension; preserve the sprite's aspect ratio. */
		size?: number;
	}
	let { visual: drawing, size = 32 }: Props = $props();
	const id = $props.id();
	// The core atlases have typed paths even when the dev manifest omits assets.
	// Catalog-specific sheets still go through the checked dynamic lookup.
	const sheetUrl = $derived.by(() => {
		switch (drawing?.sheet) {
			case "springobjects.png":
				return asset(uiAtlases.objects.path);
			case "Craftables.png":
				return asset(uiAtlases.craftables.path);
			default:
				return drawing ? dynamicAsset(`assets/${drawing.sheet}`) : undefined;
		}
	});
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
								<feColorMatrix
									type="matrix"
									values={tintMatrix(layer.tint)}
								/>
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
			<span
				class="fallback"
				style:width="100%"
				style:height="100%"
			>
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
	<span
		class="fallback"
		style:width={`${size}px`}
		style:height={`${size}px`}
	>
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
