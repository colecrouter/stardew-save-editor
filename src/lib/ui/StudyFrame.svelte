<script lang="ts">
	import type { Snippet } from "svelte";
	import { frameParts } from "./frame/frameParts";
	let { children }: { children: Snippet } = $props();
	const corners = ["outer-tl", "outer-tr", "outer-bl", "outer-br"] as const;
	const edges = [
		"outer-top",
		"outer-bottom",
		"outer-left",
		"outer-right",
	] as const;
</script>

<div class="study-frame">
	{@render children()}
	{#each [...edges, ...corners] as name (name)}
		<span
			aria-hidden="true"
			class="art {name}"
			style:background-image={`url("${frameParts[name].url}")`}
			style:--width={`${frameParts[name].width}px`}
			style:--height={`${frameParts[name].height}px`}
		></span>
	{/each}
</div>

<style>
	.study-frame {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: var(--study-frame-height, auto);
		padding: 24px 24px 28px;
		background: #542710;
	}
	.art {
		position: absolute;
		pointer-events: none;
		z-index: 5;
		image-rendering: pixelated;
		width: var(--width);
		height: var(--height);
		background-repeat: no-repeat;
	}
	.outer-tl {
		left: 0;
		top: 0;
	}
	.outer-tr {
		right: 0;
		top: 0;
	}
	.outer-bl {
		left: 0;
		bottom: 0;
	}
	.outer-br {
		right: 0;
		bottom: 0;
	}
	.outer-top {
		left: 40px;
		right: 50px;
		top: 0;
		width: auto;
		background-repeat: repeat-x;
	}
	.outer-bottom {
		left: 48px;
		right: 48px;
		bottom: 0;
		width: auto;
		background-repeat: repeat-x;
	}
	.outer-left {
		left: 0;
		top: 60px;
		bottom: 52px;
		height: auto;
		background-repeat: repeat-y;
	}
	.outer-right {
		right: 0;
		top: 72px;
		bottom: 52px;
		height: auto;
		background-repeat: repeat-y;
	}
</style>
