<script lang="ts">
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
</script>

<UiContainer>
	{#key save.player}
		<h3>Relationships</h3>
		<div class="wrapper">
			{#each save.player.raw.friendshipData.item as character}
				<HeartBar bind:npc={character} />
			{/each}
		</div>
	{/key}
</UiContainer>

<style>
	.wrapper {
		overflow-y: scroll;
		height: 20rem;
	}
</style>
