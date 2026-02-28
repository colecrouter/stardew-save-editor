<script lang="ts">
	import { resolve } from "$app/paths";
	import UiButton from "$lib/ui/UIButton.svelte";
</script>

<nav>
	<UiButton href={resolve("/inventory")} alt="Inventory">🎒</UiButton>
	<UiButton href={resolve("/character")} alt="Character">🙋</UiButton>
	<UiButton href={resolve("/appearance")} alt="Appearance">🪞</UiButton>
	<UiButton href={resolve("/relationships")} alt="Relationships">💖</UiButton>
	<UiButton href={resolve("/crafting")} alt="Crafting">🔨</UiButton>
	<UiButton href={resolve("/cooking")} alt="Cooking">🍫</UiButton>
	<UiButton href={resolve("/farmhands")} alt="Farmhands">👩‍🌾</UiButton>
	<UiButton href={resolve("/buildings")} alt="Buildings">🏠</UiButton>
	<UiButton href={resolve("/bundles")} alt="Community Center">🎁</UiButton>
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
