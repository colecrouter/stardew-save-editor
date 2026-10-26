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
		margin-left: -4px;
		background: linear-gradient(110deg, #ffe3af, #fcdda6);
	}
	/* Profiles and corner caps share the study's source grid. The 4px overlap is
    part of the paper/post join, independent of the scrollable content. */
	.parchment-pane::before {
		content: "";
		position: absolute;
		inset: -8px -8px -8px -4px;
		pointer-events: none;
		z-index: 3;
		background:
			url("./art/workspace-tl.png") left top no-repeat,
			url("./art/workspace-tr.png") right top no-repeat,
			url("./art/workspace-bl.png") left bottom no-repeat,
			url("./art/workspace-br.png") right bottom no-repeat,
			url("./art/paper-top.png") left top repeat-x,
			url("./art/paper-bottom.png") left bottom repeat-x,
			url("./art/paper-left.png") 4px top repeat-y,
			url("./art/paper-right.png") right top repeat-y;
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
