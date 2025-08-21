<script lang="ts">
	import { base } from "$app/paths";
	import UiButton from "$lib/ui/UIButton.svelte";
</script>

<nav>
	<UiButton href={`${base}/inventory`} alt="Inventory">🎒</UiButton>
	<UiButton href={`${base}/character`} alt="Character">🙋</UiButton>
	<UiButton href={`${base}/appearance`} alt="Appearance">🪞</UiButton>
	<UiButton href={`${base}/relationships`} alt="Relationships">💖</UiButton>
	<UiButton href={`${base}/crafting`} alt="Crafting">🔨</UiButton>
	<UiButton href={`${base}/cooking`} alt="Cooking">🍫</UiButton>
	<UiButton href={`${base}/farmhands`} alt="Farmhands">👩‍🌾</UiButton>
	<UiButton href={`${base}/bundles`} alt="Community Center">🎁</UiButton>
</nav>

<style>
	nav {
		display: flex;
		flex-direction: row;
		gap: 8px;
		justify-content: start;
		padding: 2px;
	}
</style>
