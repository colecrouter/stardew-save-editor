<script lang="ts">
	import { characters } from "$lib/NPCs";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const player = $derived(save.player);
	const friendships = $derived(Array.from(player.friendships));
	const missingCharacters = $derived(
		characters.filter((name) => !player.friendships.has(name)),
	);
</script>

<UiContainer>
	<h3>Relationships</h3>
	<div class="toolbar">
		<h4>NPCs encountered: {friendships.length}</h4>

		<UiButton
			onclick={() => player.friendships.addMissingCharacters()}
			disabled={missingCharacters.length === 0}
			data-testid="add-missing-friendships"
		>
			<h4>
				{#if missingCharacters.length === 0}
					No missing NPCs
				{:else}
					Add all missing NPCs
				{/if}
			</h4>
		</UiButton>
	</div>
	<div class="wrapper">
		{#each friendships as [name, npc] (name)}
			<HeartBar {name} {npc} />
		{/each}
	</div>
	<small class="credit">
		Descriptions and loved gifts from the
		<a href="https://stardewvalleywiki.com" target="_blank" rel="noreferrer"
			>Stardew Valley Wiki</a
		>
		(CC BY-NC-SA 3.0).
	</small>
</UiContainer>

<style>
	.wrapper {
		overflow-y: scroll;
		height: 20rem;
	}

	.credit {
		display: block;
		margin-top: 6px;
		font-size: x-small;
		opacity: 0.8;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
</style>
