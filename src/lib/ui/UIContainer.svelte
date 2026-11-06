<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children: Snippet;
		[key: string]: unknown;
	}

	let { children, ...props }: Props = $props();
</script>

<div class="outer">
	<div class="container" {...props}>
		{@render children()}
	</div>
</div>

<style>
	.container {
		box-sizing: border-box;
		width: 100%;
		/* min-width: 445px;
        min-height: 200px; */
		background-color: var(--ui-panel-bg, #ffc677);
		padding: var(--ui-panel-padding, 16px);
		box-shadow: var(
			--ui-panel-shadow,
			0 0 0 2px #da9457,
			0 0 0 4px #8e3d04,
			0 0 0 6px #d97804,
			0 0 0 8px #a84a07,
			0 0 0 10px #5b2b29
		);
		border-radius: 2px;
	}

	.outer {
		width: var(--ui-panel-width, auto);
		box-sizing: border-box;
		max-width: 100%;
		display: inline-block;
		padding: var(--ui-panel-inset, 10px);
	}
</style>
