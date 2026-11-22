<script lang="ts">
	import { asset } from "$app/paths";

	import metadata from "./art/icon-regions.json";
	import atlas from "./art/icons.png";
	import { pageIconNames, type StudyIconName, studyIcons } from "./studyIcons";

	let { name, size = 28 }: { name: StudyIconName; size?: number } = $props();
	// The sixteen custom page icons use PNGs. Other names still use the atlas
	// (for legacy illustrations) or code-native action, season and newer section glyphs.
	// Preserve the source canvas and aspect ratio so Photoshop replacements can
	// adjust their optical bounds without changing navigation layout.
	// Finding the literal name narrows the filename without a path assertion;
	// Kit verifies each possible static path, including the deployment base.
	const pageName = $derived(
		pageIconNames.find((candidate) => candidate === name),
	);
	const rect = $derived(
		name in metadata.regions
			? metadata.regions[name as keyof typeof metadata.regions]
			: undefined,
	);
	const paths = $derived(
		name in studyIcons ? studyIcons[name as keyof typeof studyIcons] : [],
	);
</script>

{#if pageName}
	<img
		src={asset(`img/ui/pages/${pageName}.png`)}
		width={size}
		height={size}
		alt=""
		aria-hidden="true"
		class="study-icon page-icon"
	/>
{:else}
	<svg
		width={size}
		height={size}
		viewBox={rect
			? `${rect.x} ${rect.y} ${rect.width} ${rect.height}`
			: "0 0 24 24"}
		preserveAspectRatio="xMidYMid meet"
		aria-hidden="true"
		focusable="false"
		class="study-icon"
	>
		{#if rect}
			<image href={atlas} width={metadata.width} height={metadata.height} />
		{:else}
			{#each paths as [fill, d] (d)}
				<path {fill} {d} />
			{/each}
		{/if}
	</svg>
{/if}

<style>
	.study-icon {
		display: inline-block;
		flex: none;
		vertical-align: middle;
		overflow: hidden;
		image-rendering: auto;
	}
	.page-icon {
		/* Photoshop exports share a 32px grid. Keep hard pixel edges when a
		   smaller secondary control reuses an icon outside native-size navigation. */
		object-fit: contain;
		image-rendering: pixelated;
	}
</style>
