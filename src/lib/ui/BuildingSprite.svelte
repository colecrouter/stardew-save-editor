<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	import { asset } from "$app/paths";
	import buildings from "$generated/buildings.json";

	interface Props {
		/** Domain views and legacy proxies share this small presentation contract. */
		building?: {
			readonly name: string | undefined;
			readonly repaired?: boolean;
		};
		/** The square stays reserved while the selected building changes. */
		size?: number;
	}

	interface SourceRect {
		X: number;
		Y: number;
		Width: number;
		Height: number;
	}
	interface BuildingSpriteData {
		name: string;
		texture?: string;
		textureSize?: { X: number; Y: number };
		sourceRect?: SourceRect;
	}
	const catalog: readonly BuildingSpriteData[] = buildings;
	// Game menu crops select one recognizable frame from a larger sheet.
	// Other buildings use the generated pixel rectangle rather than tile footprints.
	const menuRects: Readonly<Record<string, SourceRect>> = {
		"Fish Pond": { X: 0, Y: 0, Width: 80, Height: 80 },
		"Junimo Hut": { X: 0, Y: 0, Width: 48, Height: 64 },
		// The first frame already combines the wooden platform and bowl. The
		// catalog's X32 bowl-only draw layer floats without its separate platform.
		"Pet Bowl": { X: 0, Y: 0, Width: 32, Height: 32 },
	};
	let { building, size = 64 }: Props = $props();
	const frameSize = $derived(Number.isFinite(size) && size > 0 ? size : 64);
	const buildingData = $derived(
		catalog.find((row) => row.name === building?.name),
	);
	const sourceRect = $derived.by(() => {
		const rect = menuRects[building?.name ?? ""] ?? buildingData?.sourceRect;
		// The catalog contains the repaired greenhouse. The game selects the ruins
		// one frame above it only when the farm's unlock flag is explicitly false.
		if (rect && building?.name === "Greenhouse" && building.repaired === false)
			return { ...rect, Y: rect.Y - rect.Height };
		return rect;
	});
	const width = $derived(sourceRect?.Width ?? buildingData?.textureSize?.X);
	const height = $derived(sourceRect?.Height ?? buildingData?.textureSize?.Y);
	// Catalog texture names must identify an installed sheet before a sprite is drawn.
	const textureUrl = $derived(
		buildingData?.texture
			? dynamicAsset(`assets/buildings/${buildingData.texture}`)
			: undefined,
	);
	const known = $derived(
		!!textureUrl && !!width && width > 0 && !!height && height > 0,
	);
	const scale = $derived(frameSize / Math.max(width ?? 1, height ?? 1));
	// Negative offsets move the chosen source pixels into the crop. Sprite and
	// scenery URLs both include the deployment base, including GitHub Pages paths.
	const spriteUrl = $derived(textureUrl ? `url("${textureUrl}")` : "none");
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
			{#if known}
				<div
					class="item"
					style:width={`${width}px`}
					style:height={`${height}px`}
					style:left={`${(frameSize - (width ?? 1) * scale) / 2}px`}
					style:top={`${(frameSize - (height ?? 1) * scale) / 2}px`}
					style:--scale={scale}
					style:--x={`${-(sourceRect?.X ?? 0)}px`}
					style:--y={`${-(sourceRect?.Y ?? 0)}px`}
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
