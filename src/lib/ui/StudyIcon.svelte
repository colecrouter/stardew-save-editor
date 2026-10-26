<script lang="ts">
	import { studyIcons, type StudyIconName } from "./studyIcons";
	let { name, size = 28 }: { name: StudyIconName; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	aria-hidden="true"
	class="study-icon"
>
	{#each studyIcons[name] as [fill, d] (d)}<path {fill} {d} />{/each}
</svg>

<style>
	.study-icon {
		flex: none;
		vertical-align: middle;
		image-rendering: pixelated;
		shape-rendering: crispEdges;
		filter: drop-shadow(0 1px 0 #351b0e70);
	}
</style>
