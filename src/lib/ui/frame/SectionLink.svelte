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
		min-height: 39px;
		padding: 4px 9px;
		color: #ffedc9;
		text-decoration: none;
		border-bottom: 1px solid #a36a354d;
		font-size: 22px;
		line-height: 1.15;
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
	a:hover {
		background: #bc7e3940;
	}
	a[aria-current="page"] {
		position: relative;
		isolation: isolate;
		min-height: 57px;
		background: transparent;
		color: #311304;
		font-weight: 700;
		border-bottom: 0;
	}
	a[aria-current="page"]::after {
		content: "";
		position: absolute;
		inset: 0;
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
			font-size: 21px;
			min-height: 44px;
			padding-inline: 6px;
			gap: 5px;
		}
	}
</style>
