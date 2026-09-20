<script lang="ts">
	import { characters } from "$lib/NPCs";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const player = save.player;
	const friendships = $derived(Array.from(player.friendships));
	const missingCharacters = $derived(
		characters.filter((name) => !player.friendships.has(name)),
	);

	function addMissingCharacters() {
		player.friendships.addMissingCharacters();
	}
</script>

<UiContainer>
	<div class="heading">
		<div>
			<h3>Relationships</h3>
			{#if missingCharacters.length > 0}
				<small>{missingCharacters.length} NPC belum ada di save ini.</small>
			{:else}
				<small>Semua NPC sudah tersedia.</small>
			{/if}
		</div>
		<UiButton
			onclick={addMissingCharacters}
			disabled={missingCharacters.length === 0}
			alt="Tambahkan semua NPC yang belum ada"
			data-testid="add-missing-friendships"
		>
			<span class="add-button">+ Add all NPCs</span>
		</UiButton>
	</div>
	<div class="wrapper">
		{#each friendships as [name, npc] (name)}
			<HeartBar {name} {npc} />
		{/each}
	</div>
</UiContainer>

<style>
	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 8px;
	}

	h3 {
		margin: 0;
	}

	small {
		display: block;
		margin-top: 4px;
	}

	.add-button {
		display: block;
		padding: 6px 10px;
		white-space: nowrap;
	}

	.wrapper {
		overflow-y: scroll;
		height: 20rem;
	}
</style>
