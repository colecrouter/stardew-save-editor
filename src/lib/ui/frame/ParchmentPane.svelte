<script lang="ts">
	import type { Snippet } from "svelte";
	let { children, footer }: { children: Snippet; footer?: Snippet } = $props();
</script>

<div class="parchment-pane">
	<div class="content" id="editor-content" tabindex="-1">
		{@render children()}
	</div>
	{#if footer}<div class="pane-footer">{@render footer()}</div>{/if}
</div>

<style>
	.parchment-pane {
		display: flex;
		flex-direction: column;
		position: relative;
		min-width: 0;
		min-height: 0;
		margin-left: -3px;
		/* Reserve the rim outset so the outer wood cannot cover its bottom. */
		margin-bottom: 6px;
		background: linear-gradient(110deg, #ffe3af, #fcdda6);
	}
	/* Reduced logical-pixel artwork shares the wood kit's integer 3x grid.
    The broad surface stays a CSS gradient; only narrow rim profiles repeat. */
	.parchment-pane::before {
		content: "";
		position: absolute;
		inset: -6px -6px -6px -3px;
		pointer-events: none;
		z-index: 3;
		image-rendering: pixelated;
		border-style: solid;
		border-color: transparent;
		border-width: 30px 30px 27px 27px;
		border-image: url("./art/parchment/frame.png") 10 10 9 9 / 30px 30px 27px
			27px / 0 repeat;
	}

	.content {
		min-width: 0;
		min-height: 0;
		overflow: auto;
		padding: 18px 22px 20px 24px;
		flex: 1;
	}
	.pane-footer:empty {
		display: none;
	}
	.pane-footer {
		flex: none;
		padding: 0 20px 8px;
	}
	@media (max-width: 900px) {
		.parchment-pane {
			margin-left: 0;
		}
		.content {
			padding: 18px;
			overflow: visible;
		}
	}
</style>
