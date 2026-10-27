<script lang="ts">
	import { asset } from "$app/paths";
	import { getItemSprite, prismaticColors, tintMatrix } from "$lib/ItemSprite";
	import type { ItemProxy } from "$lib/proxies/items";

	interface Props {
		item: ItemProxy | undefined;
	}
	let { item }: Props = $props();
	const id = $props.id();
	const prismaticMatrices = [...prismaticColors, prismaticColors[0]]
		.map(tintMatrix)
		.join(";");
	let drawing = $derived(getItemSprite(item));
	let zoom = $derived(
		32 /
			Math.max(
				drawing?.sprite.sourceRect.width ?? 0,
				drawing?.sprite.sourceRect.height ?? 0,
				16,
			),
	);
</script>

{#if item}
	{#if drawing}
		<div
			class="item"
			aria-hidden="true"
			style:width={`${drawing.sprite.sourceRect.width * zoom}px`}
			style:height={`${drawing.sprite.sourceRect.height * zoom}px`}
		>
			{#each drawing.layers as layer, i (i)}
				<svg
					class="layer"
					width="100%"
					height="100%"
					viewBox={`${layer.sourceRect.x} ${layer.sourceRect.y} ${layer.sourceRect.width} ${layer.sourceRect.height}`}
				>
					{#if layer.tint || layer.prismatic}
						<defs>
							<filter id={`${id}-tint-${i}`} color-interpolation-filters="sRGB">
								<feColorMatrix
									type="matrix"
									values={tintMatrix(
										layer.prismatic ? prismaticColors[0] : layer.tint,
									)}
								>
									{#if layer.prismatic}
										<!-- Utility.GetPrismaticColor: six colors, 1500ms per transition. -->
										<animate
											attributeName="values"
											values={prismaticMatrices}
											dur="9s"
											repeatCount="indefinite"
										/>
									{/if}
								</feColorMatrix>
							</filter>
						</defs>
					{/if}
					<image
						href={asset(`/assets/${drawing.sprite.sheet}`)}
						width={drawing.sprite.sheetSize.width}
						height={drawing.sprite.sheetSize.height}
						filter={layer.tint || layer.prismatic
							? `url(#${id}-tint-${i})`
							: undefined}
					/>
				</svg>
			{/each}
			{#if drawing.smoked}
				{#each [0, 1, 2] as particle (particle)}
					<div
						class="smoke"
						style:--particle={particle}
						style:background-image={`url(${asset("/assets/Cursors.png")})`}
					></div>
				{/each}
			{/if}
		</div>
	{:else}
		<div class="item">??</div>
	{/if}
{/if}

<style>
	.item {
		position: relative;
	}
	.layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		image-rendering: pixelated;
	}
	.smoke {
		position: absolute;
		left: calc(8px + var(--particle) * 4px);
		top: calc(8px + var(--particle) * 2px);
		width: 10px;
		height: 10px;
		background-position: -372px -1956px;
		image-rendering: pixelated;
		filter: brightness(0.31);
		animation: smoke 2s linear infinite;
		animation-delay: calc(var(--particle) * -0.8s);
		pointer-events: none;
	}
	@keyframes smoke {
		from {
			transform: translateY(0) rotate(0deg);
			opacity: 0.53;
		}
		to {
			transform: translateY(-30px) rotate(-115deg);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.smoke {
			animation: none;
			opacity: 0;
		}
	}
</style>
