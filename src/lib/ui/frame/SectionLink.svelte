<script lang="ts">
	import StudyIcon from "../StudyIcon.svelte";
	import type { StudyIconName } from "../studyIcons";
	let {
		href,
		label,
		icon,
		active = false,
		onclick,
	}: {
		href: string;
		label: string;
		icon: StudyIconName;
		active?: boolean;
		onclick?: () => void;
	} = $props();
</script>

<a {href} aria-current={active ? "page" : undefined} {onclick}>
	<span class="glyph"><StudyIcon name={icon} size={28} /></span><span
		class="label">{label}</span
	>
</a>

<style>
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
		min-height: 56px;
		background: #ffd477 url("./art/tab-fill.png") left top repeat-x;
		color: #311304;
		font-weight: 700;
		border-bottom-color: transparent;
	}
	a[aria-current="page"]::after {
		content: "";
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		border: 20px solid transparent;
		border-left-width: 14px;
		border-image: url("./art/section-border.png") 20 20 20 14 / 20px 20px 20px
			14px / 0 repeat;
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
