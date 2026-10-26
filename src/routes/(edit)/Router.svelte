<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import StudyIcon from "$lib/ui/StudyIcon.svelte";
	import type { StudyIconName } from "$lib/ui/studyIcons";
	const routes = [
		["/inventory", "Inventory", "inventory"],
		["/chests", "Chests", "chests"],
		["/character", "Character", "character"],
		["/appearance", "Appearance", "appearance"],
		["/relationships", "Relationships", "relationships"],
		["/events", "Events", "events"],
		["/crafting", "Crafting", "crafting"],
		["/cooking", "Cooking", "cooking"],
		["/farmhands", "Farmhands", "farmhands"],
		["/farm", "Farm", "farm"],
		["/buildings", "Buildings", "buildings"],
		["/bundles", "Community Center", "community"],
		["/quests", "Quests", "quests"],
		["/qi-quests", "Qi's Quests", "qi"],
	] as const satisfies readonly (readonly [string, string, StudyIconName])[];
	let expanded = $state(false);
	const current = $derived(
		routes.find(([path]) => page.url.pathname === resolve(path))?.[1] ??
			"Sections",
	);
</script>

{#snippet links()}
	{#each routes as [path, label, icon] (path)}
		<a
			href={resolve(path)}
			aria-current={page.url.pathname === resolve(path) ? "page" : undefined}
			onclick={() => (expanded = false)}
		>
			<span class="glyph"><StudyIcon name={icon} size={28} /></span><span
				class="label">{label}</span
			>
		</a>
	{/each}
{/snippet}
<nav aria-label="Save editor sections" class="desktop-nav">
	{@render links()}
</nav>
<details class="mobile-nav" bind:open={expanded}>
	<summary>Sections <span>{current}</span></summary>
	<nav aria-label="Save editor sections">{@render links()}</nav>
</details>

<style>
	.desktop-nav {
		display: flex;
		flex-direction: column;
		padding: 4px;
	}
	nav {
		min-width: 0;
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
		color: #44270f;
		background: linear-gradient(#ffe2a2, #f4c56d);
		outline: 1px solid #44220d;
		box-shadow: inset 0 0 0 2px #fff0bd;
		border-radius: 3px;
		font-weight: 700;
	}
	.mobile-nav {
		display: none;
	}
	@media (max-width: 900px) {
		.desktop-nav {
			display: none;
		}
		.mobile-nav {
			display: block;
			color: #ffedc9;
		}
		summary {
			padding: 8px 12px;
			cursor: pointer;
			min-height: 44px;
		}
		summary span {
			float: right;
			color: #ffdc91;
		}
		.mobile-nav nav {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 4px;
			gap: 2px;
		}
		a {
			font-size: 21px;
			min-height: 44px;
			padding-inline: 6px;
			gap: 5px;
		}
	}
</style>
