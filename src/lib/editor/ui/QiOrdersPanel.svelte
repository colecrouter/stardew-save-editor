<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createQiOrderDomain } from "../qi-order-domain.ts";
	import { MAX_QI_OFFERS } from "../qi-order-operations.ts";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import ConfirmAction from "./ConfirmAction.svelte";
	import QuestNoticeBoard from "./QuestNoticeBoard.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const domain = $derived(
		view.current?.qiOrders
			? createQiOrderDomain(view.current.qiOrders, model)
			: undefined,
	);
	let search = $state("");
	const rows = $derived(
		(domain?.rows ?? []).filter((row) =>
			[row.name, row.description, row.key].some((value) =>
				value.toLowerCase().includes(search.trim().toLowerCase()),
			),
		),
	);
	// UI status names explain the existing state without exposing serialized enum
	// labels as the visual vocabulary. Unknown imported states retain their text.
	function status(state: string | undefined, offered: boolean) {
		if (state === "InProgress") return "Active challenge";
		if (state === "Complete") return "Completed";
		if (state === "Failed") return "Failed";
		return state ?? (offered ? "On the board" : "Available challenge");
	}
	const notices = $derived(
		rows.map((row) => ({
			key: row.key,
			title: row.name,
			summary: row.description,
			meta: row.known
				? `${row.rewardGems} Qi Gems · ${row.duration} challenge`
				: "Imported order",
			status: status(row.state, row.offered),
		})),
	);
</script>

<div class="heading">
	<div>
		<h1>Qi's orders</h1>

		<p class="subtitle">The Walnut Room · Shared by the farm</p>
	</div>

	<strong class="offer-count">
		{domain?.offeredCount ?? 0}/{MAX_QI_OFFERS} board offers
	</strong>
</div>

<div class="toolbar">
	<label>
		Search Qi orders
		<input
			class="study-input"
			type="search"
			placeholder="Name, description or ID"
			bind:value={search}
		/>
	</label>

	<p>Choose a notice to inspect its challenge.</p>
</div>

{#if !domain?.supported}
	<StudyAlert title="Qi orders unavailable" tone="warning">
		<p>{domain?.reason ?? "Qi orders are unavailable."}</p>
	</StudyAlert>
{/if}

{#if domain}
	<QuestNoticeBoard
		label="Qi order notices"
		tone="qi"
		items={notices}
		empty="No Qi orders match your search."
	>
		{#snippet detail(key)}
			{@const row = rows.find((candidate) => candidate.key === key)}
			{#if row}
				<section aria-label={`${row.name} order`}>
					<header>
						<p class="eyebrow">Mr. Qi's challenge</p>

						<h2>{row.name}</h2>

						<span class="state">{status(row.state, row.offered)}</span>
					</header>

					<p class="description">{row.description}</p>

					{#if row.known}
						<dl class="reward-details">
							<div>
								<dt>Reward</dt>

								<dd>{row.rewardGems} Qi Gems</dd>
							</div>

							<div>
								<dt>Duration</dt>

								<dd>{row.duration} challenge</dd>
							</div>
						</dl>
					{/if}

					{#if row.deadline}
						<p class="deadline">Deadline: {row.deadline}</p>
					{/if}

					<div class="actions">
						<CheckboxField field={row.offeredField} />

						{#if row.state === "InProgress"}
							<ConfirmAction
								title={`Cancel ${row.name}?`}
								description={row.cancelDescription}
								label={`Cancel ${row.name}`}
								disabled={!row.cancelAvailable}
								commit={row.cancel}
							/>
						{:else if row.state === undefined && row.known}
							<ConfirmAction
								title={`Start ${row.name}?`}
								description={row.acceptDescription}
								label={`Make ${row.name} active`}
								disabled={!row.acceptAvailable}
								commit={row.accept}
							/>
						{/if}
					</div>

					{#if row.known}
						<p class="edit-note">
							Making a challenge active bypasses the weekly acceptance limit.
							Progress and rewards are earned in-game.
						</p>
					{/if}
				</section>
			{/if}
		{/snippet}
	</QuestNoticeBoard>
{/if}

<style>
	/* The search and heading sit outside the notice board, so give their
       shared input the same Qi palette without recolouring other screens. */
	.heading,
	.toolbar {
		--study-ink: #342b58;
		--study-paper-light: #f4edf9;
		--study-rule: #b9a7ce;
		color: #342b58;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	.subtitle {
		color: #625a83;
		font-size: 18px;
		margin-top: 8px;
	}
	.offer-count {
		color: #584577;
		font-weight: 400;
		border: 2px solid #9b83b5;
		background: #eee5f6;
		padding: 8px 12px;
	}
	.toolbar {
		margin: 24px 0;
		align-items: end;
	}
	.toolbar label {
		display: grid;
		gap: 8px;
		width: min(100%, 360px);
	}
	.toolbar p {
		font-size: 18px;
		color: #625a83;
	}
	section {
		color: var(--notice-ink, #3c3156);
		min-width: 0;
	}
	header {
		border-bottom: 2px solid var(--notice-rule, #ae98bd);
		padding-bottom: 20px;
		margin-bottom: 24px;
	}
	.eyebrow {
		color: var(--notice-muted, #655579);
		font-size: 18px;
		margin-bottom: 12px;
	}
	h2 {
		font-size: 29px;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	.state {
		display: inline-block;
		color: var(--notice-accent, #584577);
		margin-top: 12px;
		font-size: 18px;
	}
	.description {
		font-size: 23px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.reward-details {
		display: flex;
		gap: 28px;
		flex-wrap: wrap;
		margin: 28px 0;
	}
	dt {
		font-size: 17px;
		color: var(--notice-muted, #655579);
		margin-bottom: 6px;
	}
	dd {
		margin: 0;
		font-size: 22px;
	}
	.deadline {
		font-size: 19px;
		margin-bottom: 24px;
	}
	.actions {
		display: flex;
		flex-direction: column;
		align-items: start;
		gap: 20px;
		border-top: 2px solid var(--notice-rule, #ae98bd);
		padding-top: 20px;
	}
	.edit-note {
		margin-top: 24px;
		color: var(--notice-muted, #655579);
		font-size: 17px;
		line-height: 1.4;
	}
	@media (max-width: 600px) {
		.toolbar {
			align-items: stretch;
		}
		.toolbar label {
			width: 100%;
		}
		h2 {
			font-size: 25px;
		}
		.description {
			font-size: 21px;
		}
	}
</style>
