<script lang="ts">
	import { lovedGiftNames } from "$lib/LovedGifts";
	import { characters } from "$lib/NPCs";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const player = $derived(save.player);
	const friendships = $derived(Array.from(player.friendships));
	const missingCharacters = $derived(
		characters.filter((name) => !player.friendships.has(name)),
	);

	let search = $state("");
	let searchBox: HTMLDivElement | undefined = $state();
	const term = $derived(search.trim().toLowerCase());
	// Match the villager's name or anything they love, universal loves included
	const matches = (name: string) =>
		[name, ...lovedGiftNames(name)].some((text) =>
			text.toLowerCase().includes(term),
		);
	const shown = $derived(
		term ? friendships.filter(([name]) => matches(name)) : friendships,
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
			placeholder="Search villagers or loved gifts..."
			aria-label="Search villagers or loved gifts"
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
	<small class="credit">
		Villager descriptions from the
		<a href="https://stardewvalleywiki.com" target="_blank" rel="noreferrer"
			>Stardew Valley Wiki</a
		>, licensed under
		<a
			href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
			target="_blank"
			rel="noreferrer">CC BY-NC-SA 3.0</a
		>.
	</small>
</UiContainer>

<style>
	.wrapper {
		overflow-y: scroll;
		/* Fill the window below the page header and the wiki credit
		   (17px), never below 20rem */
		height: max(20rem, calc(100dvh - 321px));
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

	.credit {
		display: block;
		margin-top: 6px;
		font-size: x-small;
		opacity: 0.8;
	}
</style>
