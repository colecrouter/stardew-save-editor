<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import UiIcon from "$lib/ui/UIIcon.svelte";
	import type { UiIconName } from "$lib/ui/uiAssets";
	const routes = [
		["/inventory", "Inventory", "inventory"],
		["/chests", "Chests", "chests"],
		["/character", "Character", "relationships"],
		["/appearance", "Appearance", "appearance"],
		["/relationships", "Relationships", "relationships"],
		["/events", "Events", "events"],
		["/crafting", "Crafting", "crafting"],
		["/cooking", "Cooking", "cooking"],
		["/farmhands", "Farmhands", "relationships"],
		["/farm", "Farm", "farm"],
		["/buildings", "Buildings", "farm"],
		["/bundles", "Community Center", "community"],
		["/quests", "Quests", "quests"],
		["/qi-quests", "Qi's Quests", "qi"],
	] as const satisfies readonly (readonly [string, string, UiIconName])[];
</script>

<nav aria-label="Save editor sections">
	{#each routes as [path, label, icon] (path)}
		<a
			href={resolve(path)}
			aria-current={page.url.pathname === resolve(path) ? "page" : undefined}
		>
			<span class="glyph"><UiIcon name={icon} /></span><span>{label}</span>
		</a>
	{/each}
</nav>

<style>
	nav {
		display: flex;
		flex-direction: column;
		padding: 4px;
		background: linear-gradient(90deg, #50280f, #713b17);
		border-right: 8px ridge #ac6b26;
	}
	a {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 52px;
		padding: 6px 14px;
		color: #fff0ce;
		text-decoration: none;
		border-bottom: 2px solid #925324;
		font-size: 26px;
	}
	.glyph {
		display: grid;
		place-items: center;
		width: 32px;
		height: 36px;
		flex: none;
	}
	a:hover {
		background: #a461274f;
	}
	a[aria-current="page"] {
		color: #321b0c;
		background: linear-gradient(#ffe8af, #ffcd6d);
		border: 2px solid #bd7828;
		outline: 2px solid #40220e;
		box-shadow: inset 0 0 0 2px #ffe7a2;
		border-radius: 6px;
		font-weight: 700;
	}
	@media (max-width: 600px) {
		nav {
			flex-direction: row;
			overflow-x: auto;
			border-right: 0;
			border-bottom: 6px ridge #ac6b26;
			gap: 4px;
		}
		a {
			flex: none;
			min-height: 48px;
			font-size: 22px;
			gap: 8px;
			padding: 4px 10px;
		}
	}
</style>
