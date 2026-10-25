<script lang="ts">
	import type { Snippet } from "svelte";
	let { children }: { children: Snippet } = $props();
</script>

<div class="study-frame">{@render children()}</div>

<style>
	.study-frame {
		position: relative;
		border: 16px solid #985018;
		border-radius: 3px;
		background: #fbe2ab;
		box-shadow:
			0 0 0 2px #3f210f,
			0 0 0 4px #c78028,
			inset 0 0 0 2px #592b13,
			inset 0 0 0 5px #d39a4d,
			inset 0 0 0 7px #fff0bd,
			0 8px 24px #102c3440;
		border-image: url("./study-frame.svg") 16 / 16px / 0 round;
		padding: 7px;
		min-width: 0;
	}
	@media (max-width: 600px) {
		.study-frame {
			border-width: 8px;
			border-image-width: 8px;
			padding: 5px;
		}
	}
</style>
