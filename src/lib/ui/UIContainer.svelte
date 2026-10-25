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
		background-color: #ffc677;
		padding: 16px;
		box-shadow:
			0 0 0 2px #da9457,
			0 0 0 4px #8e3d04,
			0 0 0 6px #d97804,
			0 0 0 8px #a84a07,
			0 0 0 10px #5b2b29;
		border-radius: 2px;
	}

	.outer {
		box-sizing: border-box;
		max-width: 100%;
		display: inline-block;
		padding: 10px;
	}
</style>
