<script lang="ts">
	import {
		type Quest,
		type QuestLog,
		questLabel,
	} from "$lib/proxies/Quest.svelte";
	import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		quest: Quest;
		log: QuestLog;
		save: SaveProxy;
		oncomplete: (quest: Quest) => void;
	}

	let { quest, log, save, oncomplete }: Props = $props();

	const followUps = $derived(
		quest.completed ? undefined : log.followUps(quest, save),
	);
	const starts = $derived(
		followUps?.start.map((next) => next.title).join(" and "),
	);
	const cantStart = $derived(
		followUps?.cantStart.map(questLabel).join(" and "),
	);
	const prizeTicket = $derived(log.prizeTicketDue(quest));
</script>

<div class="entry" data-testid="quest">
	<div class="header">
		<span class="title" data-testid="quest-title">{quest.title}</span>
		{#if quest.helpWanted}
			<span class="tag" data-testid="quest-help-wanted">Help Wanted</span>
		{/if}
		{#if quest.secret}
			<span class="tag" title="Hidden in-game" data-testid="quest-secret">
				Secret
			</span>
		{/if}
		{#if quest.completed}
			<span class="tag" data-testid="quest-reward-pending">Reward waiting</span>
		{/if}
	</div>

	<span class="text">{quest.description}</span>
	{#if !quest.completed && quest.objective}
		<span class="text objective">{quest.objective}</span>
	{/if}

	<div class="fields">
		{#if quest.secret}
			{#if quest.friendshipReward}
				<span data-testid="quest-friendship-reward">
					Reward: {quest.friendshipReward} friendship points
				</span>
			{/if}
		{:else}
			<label>
				Reward
				<span class="gold">
					<UiInput
						type="number"
						min="0"
						max="99999"
						step="1"
						bind:value={quest.goldReward}
						data-testid="quest-reward"
					/>g
				</span>
			</label>
			{#if quest.helpWanted && !quest.completed}
				<small>The game updates its description to match.</small>
			{/if}
		{/if}
		{#if quest.rewardText}
			<span>Also: {quest.rewardText}</span>
		{/if}

		{#if quest.timed && !quest.completed}
			<label>
				Days left
				<UiInput
					type="number"
					min="1"
					max="99"
					step="1"
					bind:value={quest.daysLeft}
					data-testid="quest-days-left"
				/>
			</label>
			<small>Counts down each night; 1 is the final day.</small>
		{:else if !quest.completed}
			<small>No time limit</small>
		{/if}
	</div>

	{#if starts}
		<small data-testid="quest-follow-ups">
			Completing it starts {starts} next.
		</small>
	{/if}
	{#if cantStart}
		<small class="warning" data-testid="quest-follow-ups-skipped">
			Finishing it in-game starts {cantStart} next. The editor can't, so if it's
			completed here, {followUps?.cantStart.length === 1
				? "that quest never starts"
				: "those quests never start"}.
		</small>
	{/if}
	{#if prizeTicket === "room"}
		<small data-testid="quest-prize-ticket">
			Completing it earns a Prize Ticket (every third Help Wanted quest does).
		</small>
	{:else if prizeTicket === "noRoom"}
		<small class="warning" data-testid="quest-prize-ticket">
			Completing it earns a Prize Ticket, but the backpack is full: free a slot
			first, or the ticket is lost.
		</small>
	{/if}
	{#if quest.completed}
		<small class="warning">Removing it forfeits the uncollected reward.</small>
	{:else if !quest.canBeCancelled}
		<small class="warning">
			The game won't let you cancel this quest, so once removed it's gone for
			good.
		</small>
	{/if}

	<div class="actions">
		{#if !quest.completed}
			<button
				type="button"
				data-testid="quest-complete"
				onclick={() => oncomplete(quest)}
			>
				Mark complete
			</button>
		{/if}
		<button
			type="button"
			data-testid="quest-remove"
			onclick={() => log.remove(quest)}
		>
			Remove
		</button>
	</div>
</div>

<style>
	.entry {
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-bottom: #5b2b2a 1px solid;
		padding: 6px 0.5em;
	}

	.title {
		font-weight: bold;
	}

	.tag {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid #5b2b2a;
		background-color: #f9bb65;
		font-size: 0.7em;
		vertical-align: middle;
	}

	.text {
		font-size: 0.85em;
		opacity: 0.85;
	}

	.objective {
		font-style: italic;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.9em;
	}

	.fields label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-weight: bold;
	}

	.gold {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	small {
		font-size: x-small;
		opacity: 0.8;
	}

	.warning {
		font-style: italic;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}

	.actions button {
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid #5b2b2a;
		background: none;
		color: inherit;
		font-family: inherit;
		font-size: 0.7em;
		white-space: nowrap;
		cursor: pointer;
	}

	.actions button:hover {
		background-color: #5b2b2a;
		color: #f9bb65;
	}
</style>
