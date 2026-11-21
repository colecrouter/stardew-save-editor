<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";

	import StudyIcon from "../../ui/StudyIcon.svelte";

	let {
		id,
		recorded,
		concealed = false,
	}: {
		id: number;
		recorded?: boolean | undefined;
		concealed?: boolean;
	} = $props();
	let sourceImage = $state<HTMLImageElement>();
	let mosaic = $state<HTMLCanvasElement>();

	function paintMosaic() {
		// Sample the actual artwork into only 36 color blocks. Enlarging this
		// tiny canvas with nearest-neighbor scaling obscures identifying detail
		// while retaining the award's palette.
		if (!sourceImage?.complete || !sourceImage.naturalWidth || !mosaic) return;
		const context = mosaic.getContext("2d");
		context?.drawImage(sourceImage, 0, 0, 6, 6);
	}
	$effect(() => {
		// Toggling concealment can mount the canvas after its image already loaded.
		// Reading both bindings here also repaints when a keyed image is replaced.
		if (concealed && sourceImage && mosaic) paintMosaic();
	});
	let failedUrl = $state<string>();
	// Local filenames use saved game IDs, not Steam's ordering or achievement
	// count. The manifest validates deployment-aware URLs without contacting Steam.
	const imageUrl = $derived(
		dynamicAsset(
			`assets/achievements/${id}${recorded === true ? "" : "-locked"}.jpg`,
		),
	);
</script>

<!-- The adjacent text owns the accessible award status. Artwork is decorative;
     its locked/unlocked variant reflects this save, not a connected Steam account. -->
<span
	class="achievement-icon"
	class:concealed
	aria-hidden="true"
>
	<!-- Separate image nodes keep an old request's URL intact for late errors. -->
	{#key imageUrl}
		{#if imageUrl && failedUrl !== imageUrl}
			<img
				bind:this={sourceImage}
				onload={paintMosaic}
				src={imageUrl}
				alt=""
				width="48"
				height="48"
				loading="lazy"
				decoding="async"
				onerror={(event) => {
					// A late failure for the old state cannot hide its replacement icon.
					failedUrl = event.currentTarget.getAttribute("src") ?? undefined;
				}}
			/>

			{#if concealed}
				<canvas
					bind:this={mosaic}
					width="6"
					height="6"
				></canvas>
			{/if}
		{:else}
			<StudyIcon
				name={recorded === true ? "check" : "review"}
				size={28}
			/>
		{/if}
	{/key}
</span>

<style>
	.achievement-icon {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
	}
	/* Keep the source loaded for canvas sampling without exposing its sharp
	   artwork; only the enlarged mosaic is visible while concealed. */
	.concealed img {
		position: absolute;
		opacity: 0;
	}
	canvas {
		width: 48px;
		height: 48px;
		image-rendering: pixelated;
		background: var(--study-rule);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
