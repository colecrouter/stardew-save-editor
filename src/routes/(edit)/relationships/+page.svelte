<script lang="ts">
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
</script>

<UiContainer>
	<h3>Relationships</h3>
	<div class="wrapper">
		{#each save.player.friendships as [name, npc]}
			<HeartBar {name} {npc} />
		{/each}
	</div>
</UiContainer>

<style>
	.wrapper {
		overflow-y: scroll;
		height: 20rem;
	}
</style>
