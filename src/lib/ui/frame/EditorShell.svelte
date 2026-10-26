<script lang="ts">
	import type { Snippet } from "svelte";
	import StudyFrame from "../StudyFrame.svelte";
	import ParchmentPane from "./ParchmentPane.svelte";
	let {
		header,
		navigation,
		children,
		footer,
		onclose,
	}: {
		header: Snippet;
		navigation: Snippet;
		children: Snippet;
		footer?: Snippet;
		onclose: () => void;
	} = $props();
</script>

<StudyFrame>
	<div class="header-pane">{@render header()}</div>
	<button
		class="frame-close"
		onclick={onclose}
		aria-label="Exit"
		data-testid="cancel-button"
	></button>
	<div class="header-beam" aria-hidden="true"></div>
	<div class="inner-wrapper">
		<aside class="navigation">{@render navigation()}</aside>
		<div class="post" aria-hidden="true"></div>
		<div class="workspace">
			<ParchmentPane {footer}>{@render children()}</ParchmentPane>
		</div>
	</div>
</StudyFrame>

<style>
	.header-pane {
		background: linear-gradient(#fddca3, #fccb81);
		position: relative;
		z-index: 3;
		flex: none;
	}
	.header-pane::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 18px;
		background: url("./art/header-left.png") repeat-y;
		pointer-events: none;
	}
	.frame-close {
		position: absolute;
		right: 4px;
		top: 12px;
		width: 44px;
		height: 48px;
		z-index: 7;
		background: url("./art/close.png") no-repeat;
		border: 0;
		padding: 0;
		cursor: pointer;
		image-rendering: pixelated;
	}
	.header-beam {
		position: relative;
		z-index: 4;
		height: 28px;
		flex: none;
		background: url("./art/header-rail.png") repeat-x;
	}
	.header-beam::before,
	.header-beam::after {
		content: "";
		position: absolute;
		pointer-events: none;
		top: -12px;
		background-repeat: no-repeat;
	}
	.header-beam::before {
		left: -24px;
		width: 38px;
		height: 60px;
		background-image: url("./art/left-header-join.png");
	}
	.header-beam::after {
		right: -24px;
		width: 36px;
		height: 68px;
		background-image: url("./art/right-header-join.png");
	}
	.inner-wrapper {
		--nav-width: 212px;
		position: relative;
		display: grid;
		grid-template-columns: var(--nav-width) 22px minmax(0, 1fr);
		flex: 1;
		min-height: 0;
	}
	.navigation {
		min-height: 0;
		overflow: hidden;
		background: #542710 url("./art/nav-left.png") left top repeat-y;
	}
	.post {
		background: url("./art/post.png") repeat-y;
		pointer-events: none;
	}
	.workspace {
		display: flex;
		min-width: 0;
		min-height: 0;
	}
	.workspace :global(.parchment-pane) {
		flex: 1;
	}
	.inner-wrapper::before,
	.inner-wrapper::after {
		content: "";
		position: absolute;
		left: calc(var(--nav-width) - 20px);
		width: 64px;
		pointer-events: none;
		z-index: 6;
		background-repeat: no-repeat;
	}
	.inner-wrapper::before {
		top: -32px;
		height: 60px;
		background-image: url("./art/upper-join.png");
	}
	.inner-wrapper::after {
		bottom: -28px;
		height: 52px;
		background-image: url("./art/lower-join.png");
	}
	@media (max-width: 900px) {
		.inner-wrapper {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 28px auto;
		}
		.inner-wrapper::before,
		.inner-wrapper::after {
			display: none;
		}
		.navigation {
			overflow: visible;
		}
		.post {
			height: 28px;
			background: url("./art/header-rail.png") repeat-x;
		}
	}
</style>
