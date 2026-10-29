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
{#if drawing.notice}<p role="status">{drawing.notice}</p>{/if}

<style>
	.preview {
		display: grid;
		place-items: center;
		min-height: 260px;
		background: linear-gradient(#8fc4d2, #d8eab1);
		border: 4px solid #8e3d04;
		image-rendering: pixelated;
	}
	.figure {
		position: relative;
		width: 38px;
		height: 80px;
		transform: scale(2);
	}
	.figure > div {
		position: absolute;
		width: 16px;
		height: 32px;
		zoom: 2.5;
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
		top: 17px;
	}
	.shirt {
		height: 8px !important;
		width: 8px !important;
		top: 15px;
		left: 4px;
	}
	.hair,
	.accessory {
		height: 16px !important;
		top: 2px;
	}
	.hair {
		top: 0;
	}
	.hat {
		height: 16px !important;
		width: 20px !important;
		top: -2px;
		left: -2px;
	}
	.pants::after,
	.shirt::after,
	.hair::after,
	.accessory::after {
		mix-blend-mode: multiply;
	}
	.female .hat {
		top: -1px;
	}
	.female .accessory {
		top: 3px;
	}
	.female .shirt {
		top: 16px;
	}
	.female .hair {
		top: 2px;
	}
	p {
		font-size: 17px;
	}
</style>
