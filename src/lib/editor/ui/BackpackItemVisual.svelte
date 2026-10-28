<script lang="ts">
	import { readRgba } from "$lib/color.ts";
	import { asset } from "$app/paths";
	import { ObjectData, ResolveItemData } from "$lib/ItemData";
	import UnknownItemVisual from "./UnknownItemVisual.svelte";
	import QualityBadge from "./QualityBadge.svelte";
	import { Sprite } from "$lib/Sprite.svelte";
	import type { Item } from "$types/save";

	interface Props {
		raw?: Record<string, unknown>;
	}

	let { raw }: Props = $props();
	const id = $props.id();

	// Resolve display metadata without constructing legacy proxies: rendering must
	// never fill missing fields or normalize the preserved inventory record.
	const drawing = $derived.by(() => {
		if (!raw) return undefined;
		let info: ReturnType<typeof ResolveItemData>;
		try {
			info = ResolveItemData(raw as unknown as Item);
		} catch {
			// The legacy lookup expects game-shaped identifiers. Imported malformed
			// or modded records remain selectable even when metadata cannot resolve.
			return undefined;
		}
		if (!info) return undefined;
		const smoked = info._key === "SmokedFish";
		const ingredient = raw.preservedParentSheetIndex;
		const parent =
			smoked &&
			(typeof ingredient === "string" || typeof ingredient === "number")
				? ObjectData.get(String(ingredient).replace(/^\([^)]*\)/, ""))
				: undefined;
		// Smoked fish draw their ingredient instead of a generic product icon.
		// Missing ingredient metadata receives the same visible unknown fallback.
		if (smoked && !parent) return undefined;
		const sprite = new Sprite(parent ?? info);
		if (sprite.sourceRect.width <= 0 || sprite.sourceRect.height <= 0)
			return undefined;
		const layers: {
			rect: typeof sprite.sourceRect;
			tint?: readonly number[];
		}[] = [{ rect: sprite.sourceRect }];
		// Saved colors affect the preview without constructing a Color proxy or
		// supplying missing channels. That keeps mere inspection read-only.
		if (smoked) {
			layers.push({ rect: sprite.sourceRect, tint: [80, 30, 10, 153] });
		} else if (
			raw["@_xsi:type"] === "Clothing" &&
			(info._type === "Shirt" || info._type === "Pants")
		) {
			const tint = readRgba(raw.clothesColor);
			// Shirts keep their original base and tint the dye mask in the second
			// half of the sheet. Pants multiply their complete base by the saved dye.
			if (info._type === "Shirt") {
				layers.push({
					rect: {
						...sprite.sourceRect,
						x: sprite.sourceRect.x + sprite.sheetSize.width / 2,
					},
					tint,
				});
			} else layers.splice(0, 1, { rect: sprite.sourceRect, tint });
		} else if (raw["@_xsi:type"] === "ColoredObject") {
			const tint = readRgba(raw.color);
			// Some colored objects tint the base; others overlay the next sheet
			// cell. Sprite resolves adjacent-cell row wrapping for the latter.
			if (raw.colorSameIndexAsParentSheetIndex === true)
				layers.splice(0, 1, { rect: sprite.sourceRect, tint });
			else layers.push({ rect: sprite.getSourceRect(1), tint });
		}
		return { sprite, layers };
	});
	const zoom = $derived(
		32 /
			Math.max(
				drawing?.sprite.sourceRect.width ?? 16,
				drawing?.sprite.sourceRect.height ?? 16,
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
		style:width={`${drawing.sprite.sourceRect.width * zoom}px`}
		style:height={`${drawing.sprite.sourceRect.height * zoom}px`}
	>
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
					href={asset(`/assets/${drawing.sprite.sheet}`)}
					width={drawing.sprite.sheetSize.width}
					height={drawing.sprite.sheetSize.height}
					filter={layer.tint ? `url(#${id}-tint-${index})` : undefined}
				/>
			</svg>
		{/each}
		<!-- Quality belongs to the saved instance; display only recognized tiers
		     without guessing at custom values or changing the preserved record. -->
		<span class="quality-badge"><QualityBadge quality={raw?.quality} /></span>
	</div>
{:else}
	<UnknownItemVisual />
{/if}

<style>
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
