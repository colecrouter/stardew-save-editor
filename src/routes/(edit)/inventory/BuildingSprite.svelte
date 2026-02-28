<script lang="ts">
	import { asset } from "$app/paths";
	import buildings from "$generated/buildings.json";
	import { Raw } from "$lib/proxies";
	import type { Building } from "$lib/proxies/Building.svelte";

	interface Props {
		building?: Building;
	}

	type BuildingSpriteData = (typeof buildings)[number] & {
		footprint?: { X: number; Y: number };
		texture?: string;
		textureSize?: { X: number; Y: number };
		sourceRect?: { X: number; Y: number; Width: number; Height: number };
	};

	const TARGET_SIZE = 64;
	const sourceRectOverrides: Record<
		string,
		{ X: number; Y: number; Width: number; Height: number }
	> = {
		Cabin: { X: 0, Y: 0, Width: 80, Height: 112 },
		"Fish Pond": { X: 0, Y: 0, Width: 80, Height: 80 },
		Farmhouse: { X: 0, Y: 0, Width: 80, Height: 144 },
		Greenhouse: { X: 0, Y: 0, Width: 112, Height: 160 },
		"Junimo Hut": { X: 0, Y: 0, Width: 64, Height: 64 },
		Mill: { X: 0, Y: 0, Width: 64, Height: 128 },
		"Pet Bowl": { X: 0, Y: 0, Width: 32, Height: 32 },
	};

	let { building }: Props = $props();

	let buildingData = $derived(
		buildings.find((b) => b.name === building?.[Raw].buildingType) as
			| BuildingSpriteData
			| undefined,
	);

	let sourceRect = $derived(
		sourceRectOverrides[building?.[Raw].buildingType ?? ""] ??
			buildingData?.sourceRect,
	);

	let spritesheet = $derived.by(() => {
		const texture = buildingData?.texture;
		if (texture) return `buildings/${texture}`;

		const type = building?.[Raw].buildingType;
		return type ? `buildings/${type}.png` : null;
	});

	let w = $derived(
		sourceRect?.Width ??
			buildingData?.textureSize?.X ??
			buildingData?.footprint?.X ??
			1,
	);
	let h = $derived(
		sourceRect?.Height ??
			buildingData?.textureSize?.Y ??
			buildingData?.footprint?.Y ??
			1,
	);
	let x = $derived(sourceRect?.X ?? 0);
	let y = $derived(sourceRect?.Y ?? 0);
	let zoom = $derived(TARGET_SIZE / Math.max(w, h));

	// Compute sprite URL for background
	let spriteUrl = $derived.by(() => {
		const sheet = spritesheet;
		return sheet ? `url("${asset(`assets/${sheet}`)}")` : "none";
	});
</script>

{#if building}
	{#if buildingData}
		<div class="wrapper">
			<div class="inner">
				<div class="clip">
					<div
						class="item"
						style:--w={`${w}px`}
						style:--h={`${h}px`}
						style:--z={zoom}
						style:--x={`${x}px`}
						style:--y={`${y}px`}
						style:--sprite={spriteUrl}
					></div>
				</div>
			</div>
		</div>
	{:else}
		<div class="item">??</div>
	{/if}
{/if}

<style>
	.wrapper {
		position: relative;
		width: 64px;
		height: 64px;
		margin: 6px;
	}

	.wrapper::before {
		content: "";
		position: absolute;
		inset: 0;
		background-image: url(/assets/daybg.png);
		background-size: 180% auto;
		background-position: center 56%;
		border-radius: 2px;
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

	.inner {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.clip {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 2px;
	}

	.item {
		position: relative;
		z-index: 1;
		display: block;
		background-image: var(--sprite);
		background-position: left var(--x) top var(--y);
		background-repeat: no-repeat;
		image-rendering: pixelated;
		width: var(--w);
		height: var(--h);
		zoom: var(--z);
	}
</style>
