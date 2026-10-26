<script lang="ts">
	let { orientation }: { orientation: "horizontal" | "vertical" } = $props();
</script>

<div class="wood-divider {orientation}" aria-hidden="true"></div>

<style>
	/* Slice the original in one axis. The filled centre repeats between fixed
    seven-pixel end caps; widths and caps both render at exactly 3x. */
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
		border-width: 0 21px;
		border-image-source: url("./art/user/post-horizontal.png");
		border-image-slice: 0 7 fill;
		border-image-width: 0 21px;
	}
	.vertical {
		width: 21px;
		height: 100%;
		border-width: 21px 0;
		border-image-source: url("./art/user/post.png");
		border-image-slice: 7 0 fill;
		border-image-width: 21px 0;
	}
</style>
