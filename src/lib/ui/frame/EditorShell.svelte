<script lang="ts">
	import type { Snippet } from "svelte";
	import StudyFrame from "../StudyFrame.svelte";
	import WoodDivider from "./WoodDivider.svelte";
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
	<div class="header-beam"><WoodDivider orientation="horizontal" /></div>
	<div class="inner-wrapper">
		<aside class="navigation">{@render navigation()}</aside>
		<div class="post"><WoodDivider orientation="vertical" /></div>
		<div class="mobile-rail"><WoodDivider orientation="horizontal" /></div>
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
	.frame-close {
		position: absolute;
		right: 4px;
		top: 12px;
		width: 44px;
		height: 48px;
		z-index: 7;
		background: url("./art/chrome/close.png") left top / 42px 48px no-repeat;
		border: 0;
		padding: 0;
		cursor: pointer;
		image-rendering: pixelated;
	}
	/* Divider caps overlap the outer timber by 9px; they do not replace its corners. */
	.header-beam {
		position: relative;
		z-index: 6;
		height: 21px;
		flex: none;
		margin-inline: -9px;
	}
	.inner-wrapper {
		--nav-width: 212px;
		display: grid;
		grid-template-columns: var(--nav-width) 21px minmax(0, 1fr);
		flex: 1;
		min-height: 0;
	}
	.navigation {
		min-height: 0;
		/* Every section stays reachable when the complete port exceeds the viewport. */
		overflow-x: hidden;
		overflow-y: auto;
		background: #542710;
	}
	.post {
		position: relative;
		z-index: 6;
		margin-top: -12px;
		margin-bottom: -9px;
	}
	.mobile-rail {
		display: none;
	}
	.workspace {
		display: flex;
		min-width: 0;
		min-height: 0;
	}
	.workspace :global(.parchment-pane) {
		flex: 1;
	}
	@media (max-width: 900px) {
		.inner-wrapper {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 21px auto;
		}
		.navigation {
			overflow: visible;
		}
		.post {
			display: none;
		}
		.mobile-rail {
			display: block;
			position: relative;
			z-index: 6;
			margin-inline: -9px;
		}
	}
</style>
