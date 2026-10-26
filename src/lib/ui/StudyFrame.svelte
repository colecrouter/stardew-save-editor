<script lang="ts">
	import type { Snippet } from "svelte";
	let { children }: { children: Snippet } = $props();
	const corners = ["tl", "tr", "bl", "br"] as const;
	const edges = ["top", "bottom", "left", "right"] as const;
</script>

<div class="study-frame">
	{@render children()}
	{#each corners as corner (corner)}<span
			class="art corner corner-{corner}"
			aria-hidden="true"
		></span>{/each}
	{#each edges as edge (edge)}<span class="art edge-{edge}" aria-hidden="true"
		></span>{/each}
</div>

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
	/* Seven-pixel timber at 3x. Ten-pixel corners include the dark joint seam;
    it must never enter a repeating edge. Tile origins stay on integer pixels. */
	.art {
		position: absolute;
		pointer-events: none;
		z-index: 5;
		image-rendering: pixelated;
		background-position: left top;
		background-repeat: no-repeat;
	}
	.corner {
		width: 30px;
		height: 30px;
		background-size: 30px 30px;
	}
	.corner-tl {
		left: 0;
		top: 0;
		background-image: url("./frame/art/user/parts/frame-tl.png");
	}
	.corner-tr {
		right: 0;
		top: 0;
		background-image: url("./frame/art/user/parts/frame-tr.png");
	}
	.corner-bl {
		left: 0;
		bottom: 0;
		background-image: url("./frame/art/user/parts/frame-bl.png");
	}
	.corner-br {
		right: 0;
		bottom: 0;
		background-image: url("./frame/art/user/parts/frame-br.png");
	}
	.edge-top,
	.edge-bottom {
		left: 30px;
		right: 30px;
		height: 21px;
		background-size: 105px 21px;
		background-repeat: repeat-x;
	}
	.edge-top {
		top: 0;
		background-image: url("./frame/art/user/parts/frame-top.png");
	}
	.edge-bottom {
		bottom: 0;
		background-image: url("./frame/art/user/parts/frame-bottom.png");
	}
	.edge-left,
	.edge-right {
		top: 30px;
		bottom: 30px;
		width: 21px;
		background-size: 21px 75px;
		background-repeat: repeat-y;
	}
	.edge-left {
		left: 0;
		background-image: url("./frame/art/user/parts/frame-left.png");
	}
	.edge-right {
		right: 0;
		background-image: url("./frame/art/user/parts/frame-right.png");
	}
</style>
