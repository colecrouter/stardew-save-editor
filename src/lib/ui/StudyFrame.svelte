<script lang="ts">
	import type { Snippet } from "svelte";
	let { children }: { children: Snippet } = $props();
</script>

<div class="study-frame">{@render children()}</div>

<style>
	.study-frame {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: var(--study-frame-height, auto);
		padding: 21px;
	}
	.study-frame::before {
		content: "";
		position: absolute;
		inset: 21px;
		background: #542710;
		z-index: -1;
		pointer-events: none;
	}
	/* Ten source pixels include each corner's seam. Slices render at 3x;
    the seven-pixel straight timber occupies 21 CSS pixels. */
	.study-frame::after {
		content: "";
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 5;
		image-rendering: pixelated;
		border: 30px solid transparent;
		border-image: url("./frame/art/user/frame.png") 10 / 30px / 0 repeat;
	}
</style>
