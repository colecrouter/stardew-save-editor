<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	let { id, recorded }: { id: number; recorded?: boolean } = $props();
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
<span class="achievement-icon" aria-hidden="true">
	<!-- Separate image nodes keep an old request's URL intact for late errors. -->
	{#key imageUrl}
		{#if imageUrl && failedUrl !== imageUrl}
			<img
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
		{:else}
			<StudyIcon name={recorded === true ? "check" : "review"} size={28} />
		{/if}
	{/key}
</span>

<style>
	.achievement-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
