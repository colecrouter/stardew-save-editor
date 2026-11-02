<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createQuestDomain } from "../quest-domain.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import QuestNoticeBoard from "./QuestNoticeBoard.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	import ConfirmAction from "./ConfirmAction.svelte";
	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.farmerChoices ?? [],
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
	let search = $state("");
	const rows = $derived(
		(domain?.quests ?? []).filter((quest) =>
			[quest.title, quest.description, quest.objective].some((text) =>
				text.toLowerCase().includes(search.trim().toLowerCase()),
			),
		),
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
<div class="journal-toolbar">
	<label>
		Search quests <input
			class="study-input"
			type="search"
			bind:value={search}
		/>
	</label>

	<span>{domain?.quests.length ?? 0} journal entries</span>
</div>

<details class="journal-help">
	<summary>About quest completion</summary>

	<StudyAside title="Completing a journal quest">
		<p>
			Gold stays in the journal to collect in-game. Completion starts supported
			follow-ups and counts Help Wanted quests toward Prize Tickets; requested
			items and friendship are unchanged.
		</p>
	</StudyAside>
</details>

{#if feedback && feedback.farmerId === domain?.farmerId && feedback.scope === model.edits.scope}
	<StudyAlert title="Journal updated" tone="success" live="polite">
		<p>{feedback.message}</p>
	</StudyAlert>
{/if}

{#if domain?.supported}
	{#if domain.unsupportedCount}
		<p role="status">
			Some imported journal entries cannot be displayed and are preserved.
		</p>
	{/if}

	{#key domain.farmerId}
		<QuestNoticeBoard
			label="Quest notices"
			items={rows.map((quest) => ({
				key: quest.renderKey,
				title: quest.title,
				summary: quest.description,
				status: quest.completed
					? "Reward waiting"
					: quest.helpWanted
						? "Help Wanted"
						: quest.secret
							? "Secret quest"
							: "Quest",
				meta: quest.completed
					? "Collect rewards in-game"
					: quest.timed
						? `${quest.daysLeft ?? "?"} ${quest.daysLeft === 1 ? "day" : "days"} left`
						: "No time limit",
			}))}
			empty={domain.quests.length
				? "No quests match your search."
				: "No quests in the journal."}
		>
			{#snippet detail(key)}
				{@const quest = rows.find((row) => row.renderKey === key)}
				{#if quest}
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
									In-game reward: {quest.friendshipReward} friendship points. The
									editor does not grant friendship.
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
								<StudyIcon name="warning" size={18} />
								Finish this quest in-game to start {quest.skippedFollowUps.join(
									", ",
								)}. The editor cannot create those follow-ups.
							</p>
						{/if}

						{#if quest.ticketDue}
							{#if quest.ticketRoom === false}
								<p class="warning">
									<StudyIcon name="warning" size={18} />
									This completion earns a Prize Ticket, but the backpack has no safe
									destination. Free a slot first, or complete it and add the lost
									ticket manually from Inventory.
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
								<StudyIcon name="warning" size={18} />
								Removing this quest forfeits its uncollected reward.
							</p>
						{:else if !quest.canBeCancelled}
							<p class="warning">
								<StudyIcon name="warning" size={18} />
								The game does not allow this quest to be cancelled. Removing it may
								prevent further progress.
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
				{/if}
			{/snippet}
		</QuestNoticeBoard>
	{/key}
{:else}
	<p role="status">
		{domain?.reason ?? "No supported farmer is available."}
	</p>
{/if}

<style>
	.heading,
	header,
	.actions,
	.journal-toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.heading,
	.journal-toolbar {
		justify-content: space-between;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 27px;
		color: var(--notice-ink);
		overflow-wrap: anywhere;
	}
	p {
		line-height: 1.4;
	}
	.journal-toolbar {
		margin-block: 20px 12px;
	}
	.journal-toolbar label {
		display: grid;
		gap: 6px;
		width: min(100%, 360px);
	}
	.journal-toolbar span {
		color: #694621;
		font-size: 18px;
	}
	.journal-help {
		margin-bottom: 20px;
	}
	.journal-help summary {
		cursor: pointer;
		padding-block: 8px;
		min-height: 44px;
		color: #694621;
	}
	section {
		min-width: 0;
		color: var(--notice-ink);
	}
	header {
		padding-bottom: 16px;
		border-bottom: 2px solid var(--notice-rule);
	}
	.tag {
		font-size: 16px;
		border: 1px solid var(--notice-rule);
		padding: 3px 7px;
		background: #f6dca7;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
		margin-block: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--notice-rule);
	}
	.objective {
		border-left: 3px solid var(--notice-accent);
		padding: 10px 14px;
		background: #f6e4bb;
		color: #715124;
	}
	.warning {
		color: #8a351c;
		font-size: 18px;
	}
	.warning :global(svg) {
		vertical-align: text-bottom;
		margin-right: 4px;
	}
	.actions {
		margin-top: 24px;
		padding-top: 16px;
		border-top: 2px solid var(--notice-rule);
	}
	@media (max-width: 1100px) and (min-width: 901px), (max-width: 480px) {
		.fields {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
