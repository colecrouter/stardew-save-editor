<script lang="ts">
	import { studyIcons, type StudyIconName } from "./studyIcons";
	import atlas from "./art/icons.png";
	import metadata from "./art/icon-regions.json";
	let { name, size = 28 }: { name: StudyIconName; size?: number } = $props();
	const rect = $derived(
		name in metadata.regions
			? metadata.regions[name as keyof typeof metadata.regions]
			: undefined,
	);
	const paths = $derived(
		name in studyIcons ? studyIcons[name as keyof typeof studyIcons] : [],
	);
</script>

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
	{#if rect}<image
			href={atlas}
			width={metadata.width}
			height={metadata.height}
		/>
	{:else}{#each paths as [fill, d] (d)}<path {fill} {d} />{/each}{/if}
</svg>

<style>
	.study-icon {
		display: inline-block;
		flex: none;
		vertical-align: middle;
		overflow: hidden;
		image-rendering: auto;
	}
</style>
