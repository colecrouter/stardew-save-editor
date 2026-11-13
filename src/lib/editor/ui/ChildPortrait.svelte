<script lang="ts">
	import { dynamicAsset } from "../../ui/dynamicAsset.ts";
	import type { ChildView } from "../children-data.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	let { child }: { child: ChildView } = $props();
	// Use Child.reloadSprite's vanilla sheets and a representative front frame.
	// Crawlers use doSetState(2)'s frame 24 (row 6), rather than reloadSprite's
	// frame 32 facing away. Each Baby row contains four 22-pixel-wide frames.
	// The hat's front frame uses Child.draw's offset (-2, 6) in sprite pixels.
	const frame = $derived.by(() => {
		if (
			child.stage === undefined ||
			child.darkSkinned === undefined ||
			!["Male", "Female"].includes(child.gender ?? "")
		)
			return undefined;
		const toddler = child.stage === 3;
		const sheet = `${toddler ? `Toddler${child.gender === "Female" ? "_girl" : ""}` : "Baby"}${child.darkSkinned ? "_dark" : ""}`;
		const source = dynamicAsset(`assets/${sheet}.png`);
		return source
			? {
					source,
					width: toddler ? 16 : 22,
					height: toddler || child.stage === 1 ? 32 : 16,
					y: child.stage === 1 ? 32 : child.stage === 2 ? 96 : 0,
				}
			: undefined;
	});
	const hat = $derived(child.stage === 3 ? child.hat.visual : undefined);
	// The game retains the lower 17 pixels of a toddler's first frame when a
	// hat hides hair. Keep that crop at its original position under the overlay.
	const hairCrop = $derived(hat && child.hat.hideHair ? 15 : 0);
</script>

<div class="portrait" aria-hidden="true">
	{#if frame}
		<div
			class="scene"
			style:width={`${frame.width * 3}px`}
			style:height={`${frame.height * 3}px`}
		>
			<div
				class="crop"
				style:top={`${hairCrop * 3}px`}
				style:height={`${(frame.height - hairCrop) * 3}px`}
			>
				<img
					src={frame.source}
					alt=""
					style:top={`${-(frame.y + hairCrop) * 3}px`}
				/>
			</div>

			{#if hat}
				<div class="hat" data-child-hat={child.hat.name}>
					<BackpackItemVisual visual={hat} size={60} />
				</div>
			{/if}
		</div>
	{:else}
		<span>{child.name.slice(0, 1) || "?"}</span>
	{/if}
</div>

<style>
	.portrait {
		width: 96px;
		height: 112px;
		flex: none;
		display: grid;
		place-items: center;
		background: var(--study-paper-inset, #f5dbab);
		border: 1px solid var(--study-rule, #987746);
	}
	.scene {
		position: relative;
	}
	.crop {
		position: absolute;
		width: 100%;
		overflow: hidden;
		image-rendering: pixelated;
	}
	.hat {
		position: absolute;
		left: -6px;
		top: 18px;
	}
	img {
		position: absolute;
		left: 0;
		width: auto;
		height: auto;
		max-width: none;
		max-height: none;
		transform: scale(3);
		transform-origin: top left;
	}
	span {
		font-size: 36px;
		color: var(--study-muted, #694621);
	}
</style>
