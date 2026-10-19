<script lang="ts">
	import { untrack } from "svelte";
	import { characters } from "$lib/NPCs";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const player = $derived(save.player);
	// Sorted by points, but only when villagers are added, replaced or removed, or
	// the farmer changes: re-sorting as points are typed would move the row being
	// edited, losing focus
	const friendships = $derived.by(() => {
		const all = player.friendships;
		// Reads every entry, so replacing a villager counts too (keys() alone can
		// miss that); their points are only read untracked, when sorting
		all.entries();
		return untrack(() => Array.from(all));
	});
	const missingCharacters = $derived(
		characters.filter((name) => !player.friendships.has(name)),
	);

	let search = $state("");
	let searchBox: HTMLDivElement | undefined = $state();
	const term = $derived(search.trim().toLowerCase());
	const shown = $derived(
		term
			? friendships.filter(([name]) => name.toLowerCase().includes(term))
			: friendships,
	);

	const clearSearch = () => {
		search = "";
		searchBox?.querySelector("input")?.focus();
	};
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
	<div class="search" bind:this={searchBox}>
		<UiInput
			type="text"
			placeholder="Search villagers..."
			aria-label="Search villagers"
			data-testid="relationships-search"
			bind:value={search}
			onkeydown={(event) => {
				if (event.key === "Escape" && search) {
					event.preventDefault();
					clearSearch();
				}
			}}
		/>
		{#if search}
			<button
				class="clear"
				type="button"
				aria-label="Clear search"
				title="Clear search"
				data-testid="relationships-search-clear"
				onclick={clearSearch}
			>
				&times;
			</button>
		{/if}
	</div>
	<div class="wrapper">
		{#each shown as [name, npc] (name)}
			<HeartBar {name} {npc} />
		{:else}
			{#if term}
				<p class="empty">No villagers match "{search.trim()}".</p>
			{/if}
		{/each}
	</div>
</UiContainer>

<style>
	.wrapper {
		overflow-y: scroll;
		/* Fill the window below the page header, never below 20rem */
		height: max(20rem, calc(100dvh - 304px));
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.search {
		position: relative;
		margin-bottom: 4px;
	}

	.search :global(input) {
		width: 100%;
		box-sizing: border-box;
		padding-right: 28px;
		font-size: large;
	}

	.clear {
		all: unset;
		position: absolute;
		top: 50%;
		right: 6px;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		line-height: 20px;
		text-align: center;
		font-size: 22px;
		font-weight: bold;
		color: #6f3b31;
		border-radius: 4px;
		cursor: pointer;
	}

	.clear:hover,
	.clear:focus-visible {
		background-color: rgba(0, 0, 0, 0.12);
	}

	.empty {
		opacity: 0.7;
		text-align: center;
	}
</style>
