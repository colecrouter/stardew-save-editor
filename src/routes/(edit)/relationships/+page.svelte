<script lang="ts">
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const friendships = Array.from(save.player.friendships);
</script>

<UiContainer>
	<h3>Relationships</h3>
	<div class="wrapper">
		{#each friendships as [name, npc] (name)}
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
