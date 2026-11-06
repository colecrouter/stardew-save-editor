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
		/* Reserve the scrollbar lane before content grows, so opening an inventory
           inspector cannot change the grid width. Match the track to the paper
           instead of exposing the browser's default white scrollbar surface. */
		scrollbar-gutter: stable;
		scrollbar-color: #a57542 #fcdda6;
		/* The top rim reaches 24px into the pane (30px artwork minus its
		   6px outset). Leave a further 6px before the first content row. */
		/* Keep the scrollbar inside the rim instead of underneath its artwork;
           the inner padding separates the last control from the scroll thumb. */
		margin-right: 24px;
		padding: 30px 8px 20px 24px;
		flex: 1;
	}
	/* Older engines retain the same geometry with an always-present vertical
    lane. WebKit scrollbar colours cover engines without scrollbar-color. */
	@supports not (scrollbar-gutter: stable) {
		.content {
			overflow-y: scroll;
		}
	}
	.content::-webkit-scrollbar {
		width: 12px;
		height: 12px;
	}
	.content::-webkit-scrollbar-track,
	.content::-webkit-scrollbar-corner {
		background: #fcdda6;
	}
	.content::-webkit-scrollbar-thumb {
		background: #a57542;
		border: 3px solid #fcdda6;
		border-radius: 6px;
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
			padding: 30px 18px 20px;
			margin-right: 0;
			overflow: visible;
			/* Phones scroll the document, so no internal lane is needed here. */
			scrollbar-gutter: auto;
		}
	}
</style>
