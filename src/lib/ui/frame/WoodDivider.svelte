<script lang="ts">
	let { orientation }: { orientation: "horizontal" | "vertical" } = $props();
</script>

<div class="wood-divider {orientation}" aria-hidden="true"></div>

<style>
	/* Seven-pixel end caps render at 3x. Keep one source pixel on the
	   cross-axis too: zero-width edge slices make the filled centre fall back
	   to 1x along its repeating axis, squeezing the grain between the caps.
	   Nonzero 3px edges establish the same 3x scale for every slice. */
	.wood-divider {
		pointer-events: none;
		image-rendering: pixelated;
		border-style: solid;
		border-color: transparent;
		border-image-repeat: repeat;
	}
	.horizontal {
		width: 100%;
		height: 21px;
		border-width: 3px 21px;
		border-image-source: url("./art/user/post-horizontal.png");
		border-image-slice: 1 7 fill;
		border-image-width: 3px 21px;
	}
	.vertical {
		width: 21px;
		height: 100%;
		border-width: 21px 3px;
		border-image-source: url("./art/user/post.png");
		border-image-slice: 7 1 fill;
		border-image-width: 21px 3px;
	}
</style>
