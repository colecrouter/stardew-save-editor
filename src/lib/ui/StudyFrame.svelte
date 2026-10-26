<script lang="ts">
	import type { Snippet } from "svelte";
	let { children }: { children: Snippet } = $props();
</script>

<div class="study-frame">{@render children()}</div>

<style>
	.study-frame {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: var(--study-frame-height, auto);
		border: 16px solid #9b561e;
		border-image: url("./study-frame.svg") 16 / 16px / 0 repeat;
		background: #77421f;
		box-shadow:
			0 0 0 2px #392415,
			0 3px 0 3px #211b1270,
			0 8px 24px #102c3440;
		padding: 2px;
		border-radius: 3px;
	}
	@media (max-width: 900px) {
		.study-frame {
			border-width: 8px;
			border-image-width: 8px;
		}
	}
</style>
