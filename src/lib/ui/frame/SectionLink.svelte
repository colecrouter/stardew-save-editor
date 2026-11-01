<script lang="ts">
	import StudyIcon from "../StudyIcon.svelte";
	import type { StudyIconName } from "../studyIcons";
	let {
		href,
		label,
		shortLabel,
		icon,
		active = false,
		onclick,
	}: {
		href: string;
		label: string;
		shortLabel?: string;
		icon: StudyIconName;
		active?: boolean;
		onclick?: () => void;
	} = $props();
</script>

<a
	{href}
	aria-label={label}
	aria-current={active ? "page" : undefined}
	{onclick}
>
	<span class="glyph"><StudyIcon name={icon} size={28} /></span>

	<span class="label" class:has-short={shortLabel !== undefined}>{label}</span>

	{#if shortLabel}
		<span class="short-label" aria-hidden="true">{shortLabel}</span>
	{/if}
</a>

<style>
	.short-label {
		display: none;
	}
	a {
		display: flex;
		align-items: center;
		gap: 10px;
		/* Every row reserves two label lines, regardless of selection. Changing
		   colour/artwork must never move a later section or its pointer target. */
		height: 48px;
		min-height: 48px;
		padding: 2px 9px;
		color: #ffedc9;
		text-decoration: none;
		border-bottom: 1px solid #a36a354d;
		font-size: 20px;
		line-height: 1.05;
	}
	.label {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.glyph {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex: none;
	}
	a:focus-visible {
		outline: 2px solid #fff0bc;
		outline-offset: -4px;
	}
	a[aria-current="page"]:focus-visible {
		outline-color: #673d21;
	}
	a:hover {
		background: #bc7e3940;
	}
	a[aria-current="page"] {
		position: relative;
		isolation: isolate;
		/* Crop the selected artwork to the existing hit target, so extending its
		   rim cannot add horizontal scroll to either navigation implementation. */
		overflow: hidden;
		background: transparent;
		color: #311304;
		/* Retain the same type metrics and border footprint as inactive rows. */
		border-bottom-color: transparent;
	}
	a[aria-current="page"]::after {
		content: "";
		position: absolute;
		/* The kit's outer brown pixel renders at 3x. Paint that right rim past
		   the clip edge so the selected fill meets the adjacent wood divider. */
		inset: 0 -3px 0 0;
		z-index: -1;
		pointer-events: none;
		image-rendering: pixelated;
		border-style: solid;
		border-color: transparent;
		border-width: 21px 21px 21px 15px;
		border-image: url("./art/chrome/selected-tab.png") 7 7 7 5 fill / 21px 21px
			21px 15px / 0 repeat;
	}
	@media (max-width: 600px) {
		/* Compact names fit the inventory's phone tab row; accessible names retain
		   the complete section labels for navigation and voice control. */
		.label.has-short {
			display: none;
		}
		.short-label {
			display: inline;
		}
	}
	@media (max-width: 900px) {
		a {
			/* The legacy two-column phone menu can need a third label line.
			   Both active and inactive links use these same content-sized metrics. */
			height: auto;
			font-size: 20px;
			min-height: 48px;
			padding-inline: 6px;
			gap: 5px;
		}
	}
</style>
