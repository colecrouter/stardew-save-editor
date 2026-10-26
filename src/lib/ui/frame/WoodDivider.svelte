<script lang="ts">
	let { orientation }: { orientation: "horizontal" | "vertical" } = $props();
</script>

<div class="wood-divider {orientation}" aria-hidden="true">
	<span class="middle"></span>
</div>

<style>
	/* All art remains at 3x. Only clean middles repeat; caps occur once at each end. */
	.wood-divider {
		position: relative;
		pointer-events: none;
		image-rendering: pixelated;
	}
	.wood-divider::before,
	.wood-divider::after {
		content: "";
		position: absolute;
		width: 21px;
		height: 21px;
		background-repeat: no-repeat;
		background-size: 21px 21px;
	}
	.horizontal {
		width: 100%;
		height: 21px;
	}
	.horizontal::before {
		left: 0;
		top: 0;
		background-image: url("./art/user/parts/rail-left.png");
	}
	.horizontal::after {
		right: 0;
		top: 0;
		background-image: url("./art/user/parts/rail-right.png");
	}
	.vertical {
		width: 21px;
		height: 100%;
	}
	.vertical::before {
		left: 0;
		top: 0;
		background-image: url("./art/user/parts/post-top.png");
	}
	.vertical::after {
		left: 0;
		bottom: 0;
		background-image: url("./art/user/parts/post-bottom.png");
	}
	.middle {
		position: absolute;
	}
	.horizontal .middle {
		inset: 0 21px;
		background: url("./art/user/parts/rail-middle.png") left top / 87px 21px
			repeat-x;
	}
	.vertical .middle {
		inset: 21px 0;
		background: url("./art/user/parts/post-middle.png") left top / 21px 108px
			repeat-y;
	}
</style>
