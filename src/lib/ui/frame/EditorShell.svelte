<script lang="ts">
	import type { Snippet } from "svelte";
	import StudyFrame from "../StudyFrame.svelte";
	import StudyButton from "../kit/StudyButton.svelte";
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
	<!-- Exit shares the filled destructive action treatment with the kit. The
	     positioned wrapper keeps frame geometry separate from button emphasis. -->
	<div class="frame-close">
		<StudyButton
			intent="destructive"
			variant="filled"
			iconOnly
			onclick={onclose}
			aria-label="Exit"
			data-testid="cancel-button"
		>
			<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
				<path
					d="m6 6 12 12M18 6 6 18"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
				/>
			</svg>
		</StudyButton>
	</div>
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
		/* Match StudyFrame's 21px timber inset so the action ends flush with
		   the header surface rather than sitting over the outer right rim. */
		right: 21px;
		top: 12px;
		width: 44px;
		height: 44px;
		z-index: 7;
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
		/* The 7px post has a transparent pixel on either side. Allocate its
		   five opaque pixels at 3x; the clear edges overlap the adjacent surfaces. */
		grid-template-columns: var(--nav-width) 15px minmax(0, 1fr);
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
		/* Preserve the full 21px artwork and its integer scale while painting
		   its transparent outer columns over the tab and parchment, not backing. */
		margin-inline: -3px;
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
