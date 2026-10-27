<script lang="ts">
	import { resolve } from "$app/paths";
	import { type Quest, questLabel } from "$lib/proxies/Quest.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import QuestEntry from "./QuestEntry.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const toastManager = getToastManager();
	const player = $derived(save.player);
	const log = $derived(player.questLog);

	function complete(quest: Quest) {
		if (!save) return;
		const { removed, started, skippedFollowUps, prizeTicket } = log.complete(
			quest,
			save,
		);
		const notes = [
			removed
				? `Completed ${quest.title}`
				: `Completed ${quest.title}: collect the reward from the journal in-game`,
		];
		if (started.length > 0)
			notes.push(`Started ${started.map((q) => q.title).join(" and ")}`);
		if (prizeTicket === "added")
			notes.push("A Prize Ticket is in the backpack");
		if (skippedFollowUps.length > 0)
			notes.push(
				`${skippedFollowUps.map(questLabel).join(" and ")} won't be started: the game only starts follow-up quests when this one is finished in-game`,
			);
		toastManager.add(new Toast(`${notes.join(". ")}.`, "success"), 8000);
		if (prizeTicket === "noRoom")
			toastManager.add(
				new Toast(
					"The backpack is full, so the Prize Ticket couldn't be added: free a slot and add one on the Inventory page",
					"failure",
				),
				8000,
			);
	}
</script>

<UiContainer>
	<h3>Quest Log</h3>
	<p class="hint">
		{player.name}'s journal, newest first as in-game. Completing a quest here
		works like finishing it in-game: its gold waits in the journal to collect,
		the next story quest starts, and Help Wanted quests count toward Prize
		Tickets. It doesn't take the items asked for or give friendship.
	</p>
	<p class="hint" data-testid="quests-qi-link">
		Special Orders also show in the in-game journal; Mr. Qi's are on the
		<a href={resolve("/qi-quests")}>Qi's Quests</a> page.
	</p>

	<div class="wrapper">
		{#each log.journal as quest (quest)}
			<QuestEntry {quest} {log} {save} oncomplete={complete} />
		{:else}
			<p class="empty">No quests in the journal.</p>
		{/each}
	</div>
</UiContainer>

<style>
	.hint {
		margin: 0 4px 8px;
		font-size: 0.85em;
		opacity: 0.85;
	}

	.hint a {
		color: inherit;
	}

	.wrapper {
		display: flex;
		flex-direction: column;
		/* Fill the window below the page header, never below 20rem */
		max-height: max(20rem, calc(100dvh - 373px));
		overflow-y: auto;
	}

	.empty {
		margin: 8px 4px;
	}
</style>
