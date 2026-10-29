<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createQuestDomain } from "../quest-domain.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import ConfirmAction from "./ConfirmAction.svelte";
	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.characters ?? [],
			selection.current,
			model,
		),
	);
	const selected = $derived(
		view.current?.questJournals.find(
			(owner) => owner.farmerId === selection.current,
		),
	);
	const domain = $derived(
		selected ? createQuestDomain(selected, model) : undefined,
	);
	type DomainQuest = ReturnType<typeof createQuestDomain>["quests"][number];
	let feedback = $state<{ farmerId: string; scope: symbol; message: string }>();
	async function completeQuest(quest: DomainQuest, farmerId: string) {
		const scope = model.edits.scope;
		const result = await quest.complete();
		// Completion can remove its own card. Keep the receipt at journal scope, and
		// do not publish a late result beside another selected farmer or reopened file.
		if (
			result &&
			Result.isSuccess(result) &&
			result.success &&
			domain?.farmerId === farmerId &&
			model.edits.scope === scope
		) {
			const done = result.success;
			const notes = [
				done.removed
					? `Completed ${quest.title}.`
					: `Completed ${quest.title}; collect the reward in-game.`,
			];
			if (done.started.length)
				notes.push(`Started ${done.started.join(", ")}.`);
			if (done.prizeTickets.includes("added"))
				notes.push("A Prize Ticket was added to the backpack.");
			if (done.prizeTickets.includes("noRoom"))
				notes.push(
					"No safe backpack slot was available for the Prize Ticket. Free a slot and add it from Inventory.",
				);
			if (done.skippedFollowUps.length)
				notes.push(
					`The editor could not start ${done.skippedFollowUps.join(", ")}.`,
				);
			feedback = { farmerId, scope, message: notes.join(" ") };
		}
		return result;
	}
</script>

<div class="heading">
	<h1>Quest journal</h1>
	<FarmerSelector field={farmerField} />
</div>
<p class="intro">
	Completing a quest leaves gold in the journal to collect in-game, starts
	supported follow-up quests and counts Help Wanted completions toward Prize
	Tickets. It does not consume requested items or grant friendship. Changes are
	Undoable.
</p>

{#if feedback && feedback.farmerId === domain?.farmerId && feedback.scope === model.edits.scope}
	<p role="status">
		{feedback.message}
	</p>
{/if}

{#if domain?.supported}
	{#if domain.unsupportedCount}
		<p role="status">
			Some imported journal entries cannot be displayed and are preserved.
		</p>
	{/if}

	{#key domain.farmerId}
		<div class="journal">
			{#each domain.quests as quest (quest.renderKey)}
				<section aria-label={`${quest.title} quest`}>
					<header>
						<h2>{quest.title}</h2>

						{#if quest.helpWanted}
							<span class="tag">Help Wanted</span>
						{/if}

						{#if quest.secret}
							<span class="tag">Secret</span>
						{/if}

						{#if quest.completed}
							<span class="tag">Reward waiting</span>
						{/if}
					</header>
					<p>{quest.description}</p>

					{#if !quest.completed && quest.objective}
						<p class="objective">
							{quest.objective}
						</p>
					{/if}

					<div class="fields">
						{#if !quest.secret}
							<NumberField field={quest.fields.reward} />
						{:else if quest.friendshipReward !== undefined}
							<p>
								In-game reward: {quest.friendshipReward} friendship points. The editor
								does not grant friendship.
							</p>
						{/if}

						{#if quest.timed && !quest.completed}
							<NumberField field={quest.fields.days} />
						{:else if !quest.completed}
							<p>No time limit</p>
						{/if}
					</div>

					{#if quest.rewardText}
						<p>Also: {quest.rewardText}</p>
					{/if}

					{#if !quest.completed && quest.followUps.length}
						<p>
							Completion starts: {quest.followUps.join(", ")}.
						</p>
					{/if}

					{#if !quest.completed && quest.skippedFollowUps.length}
						<p class="warning">
							Finish this quest in-game to start {quest.skippedFollowUps.join(
								", ",
							)}. The editor cannot create those follow-ups.
						</p>
					{/if}

					{#if quest.ticketDue}
						{#if quest.ticketRoom === false}
							<p class="warning">
								This completion earns a Prize Ticket, but the backpack has no
								safe destination. Free a slot first, or complete it and add the
								lost ticket manually from Inventory.
							</p>
						{:else}
							<p>
								Completing this quest earns a Prize Ticket. It is added to an
								existing stack or empty backpack slot when possible.
							</p>
						{/if}
					{/if}

					{#if quest.completed}
						<p class="warning">
							Removing this quest forfeits its uncollected reward.
						</p>
					{:else if !quest.canBeCancelled}
						<p class="warning">
							The game does not allow this quest to be cancelled. Removing it
							may prevent further progress.
						</p>
					{/if}

					{#if quest.reason}
						<p role="status">{quest.reason}</p>
					{/if}

					<div class="actions">
						{#if !quest.completed}
							<ConfirmAction
								title={`Complete ${quest.title}?`}
								description={`Complete this quest and start its supported follow-ups in one Undo step. Gold remains in the journal to collect in-game. Requested items and friendship are unchanged.${quest.ticketDue ? (quest.ticketRoom === false ? " This completion earns a Prize Ticket, but there is no safe backpack destination. The ticket will not be added; free a slot first or add it manually afterward." : " This completion earns a Prize Ticket if the backpack has room.") : ""}${quest.skippedFollowUps.length ? ` Unsupported follow-ups will not start: ${quest.skippedFollowUps.join(", ")}.` : ""}`}
								label={`Complete ${quest.title}`}
								disabled={!quest.supported}
								commit={() => completeQuest(quest, domain.farmerId)}
							/>
						{/if}

						<ConfirmAction
							title={`Remove ${quest.title}?`}
							description={`Remove this quest from the journal without granting rewards or starting follow-ups.${quest.completed ? " Its uncollected reward will be forfeited." : !quest.canBeCancelled ? " The game does not allow cancelling it; removing it may prevent further progress." : ""} Undo restores it.`}
							label={`Remove ${quest.title}`}
							disabled={!quest.supported}
							commit={quest.remove}
						/>
					</div>
				</section>
			{:else}
				<p>No quests in the journal.</p>
			{/each}
		</div>
	{/key}
{:else}
	<p role="status">
		{domain?.reason ?? "No supported farmer is available."}
	</p>
{/if}

<style>
	.heading,
	header,
	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.heading {
		justify-content: space-between;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 24px;
	}
	.intro,
	p {
		line-height: 1.4;
	}
	.intro {
		font-size: 17px;
		color: #694621;
	}
	.journal {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px;
		margin-top: 24px;
	}
	section {
		border-top: 1px solid #bb925e;
		padding: 18px 0;
		min-width: 0;
	}
	.tag {
		font-size: 16px;
		border: 1px solid #9a6433;
		padding: 3px 7px;
		background: #f9d997;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	.objective {
		font-style: italic;
	}
	.warning {
		color: #8a351c;
		font-size: 17px;
	}
	.actions {
		margin-top: 16px;
	}
	@media (max-width: 1000px) {
		.journal {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 480px) {
		.fields {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
