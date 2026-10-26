<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import SectionLink from "$lib/ui/frame/SectionLink.svelte";
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
		<SectionLink
			href={resolve(path)}
			{label}
			{icon}
			active={page.url.pathname === resolve(path)}
			onclick={() => (expanded = false)}
		/>
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
		height: 100%;
		overflow: auto;
		padding: 4px;
	}
	nav {
		min-width: 0;
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
	}
</style>
