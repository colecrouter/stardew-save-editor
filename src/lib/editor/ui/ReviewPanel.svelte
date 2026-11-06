<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import type { ReviewView, ReviewFeature } from "../review-contract.ts";
	import type { ImmutableView } from "../immutable-view.ts";
	import { presentReviewChange } from "../review-presentation.ts";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	import type { StudyIconName } from "../../ui/studyIcons.ts";
	import ReviewRawChange from "./ReviewRawChange.svelte";
	let {
		model,
		includeProofs = false,
		active = true,
	}: {
		model: EditorModel;
		includeProofs?: boolean;
		active?: boolean;
	} = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const pending = useAtomValue(() => model.atomBindings.pending);
	let comparison = $state<ImmutableView<ReviewView>>();
	let loading = $state(false);
	let failed = $state(false);
	let retry = $state(0);
	let historyOpen = $state(false);
	let technicalOpen = $state(false);
	let error = $state("");
	const icons = {
		farm: "farm",
		calendar: "calendar",
		character: "character",
		inventory: "inventory",
		relationships: "relationships",
		quests: "quests",
		qi: "qi",
		community: "community",
		buildings: "buildings",
		pets: "relationships",
		farmhands: "farmhands",
		recipes: "cooking",
		events: "events",
		appearance: "appearance",
	} satisfies Record<ReviewFeature, StudyIconName>;
	// A hidden review screen must not build comparisons on every keystroke in
	// another editor. Ignore late reads after navigation or a newer revision.
	$effect(() => {
		const revision = view.current?.revision;
		void retry;
		if (!active || revision === undefined || comparison?.revision === revision)
			return;
		let current = true;
		loading = true;
		failed = false;
		void model.commands.review().then((result) => {
			if (!current || view.current?.revision !== revision) return;
			if (result && Result.isSuccess(result)) comparison = result.success;
			else failed = true;
			loading = false;
		});
		return () => {
			current = false;
		};
	});
	async function reverse() {
		// Capture one committed projection for the entire permutation. A reactive
		// accessor can change later; the operation itself still validates the target.
		const snapshot = view.current;
		if (!snapshot) return;
		error = "";
		const result = await model.commands.execute([
			{
				type: "reorder",
				ownerId: snapshot.farmerId,
				order: Array.from(
					{ length: snapshot.backpackSize },
					(_, i) => snapshot.backpackSize - i - 1,
				),
			},
		]);
		if (result && Result.isFailure(result)) error = result.failure.message;
	}
</script>

{#if view.current}
	<header class="review-heading">
		<div>
			<h1>Review changes</h1>

			<p>Compared with the imported save</p>
		</div>
	</header>

	<div class="comparison" aria-busy={loading}>
		<h2>Changes in this export</h2>

		{#if failed}
			<StudyAlert title="Comparison unavailable" tone="warning">
				<p>The comparison could not be completed. Your edits are kept.</p>
			</StudyAlert>

			<StudyButton onclick={() => retry++}>Retry comparison</StudyButton>
		{:else if loading || comparison?.revision !== view.current.revision}
			<p role="status">Updating comparison…</p>
		{:else if view.current.net.length === 0}
			<StudyAlert title="No changes to export" tone="success">
				<p>No exported changes from the imported save.</p>
			</StudyAlert>
		{:else if comparison}
			{#each comparison.groups as group (group.feature)}
				<section class="review-group" aria-label={group.label}>
					<h3>
						<StudyIcon name={icons[group.feature]} size={26} />
						{group.label}
					</h3>

					<table>
						<thead>
							<tr>
								<th scope="col">Change</th>
								<th scope="col">Before</th>
								<th scope="col">After</th>
							</tr>
						</thead>

						<tbody>
							{#each group.changes as change, index (index)}
								{@const row = presentReviewChange(change)}
								<tr>
									<th scope="row">
										{row.label}
										<span class="context">{row.context}</span>
									</th>
									<td class="before">{row.before}</td>
									<td class="after">{row.after}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/each}

			{#if comparison.otherChanges.length}
				<section class="review-group other" aria-label="Other save changes">
					<h3><StudyIcon name="notice-info" size={26} /> Other save changes</h3>

					<p>
						{comparison.otherChanges.length} save-field changes have no complete domain
						summary. Inspect them below.
					</p>

					{#each comparison.otherChanges as patch, index (index)}
						<ReviewRawChange {patch} />
					{/each}
				</section>
			{/if}
		{/if}
	</div>

	<details class="secondary" bind:open={historyOpen}>
		<summary>Edit history</summary>

		{#if historyOpen}
			<p class="explanation">
				Actions you took, including edits later changed or undone. Export
				changes above show the final result.
			</p>

			{#if view.current.dropped}
				<p>
					{view.current.dropped} older Undo entries are no longer retained. The export
					comparison still includes their changes.
				</p>
			{/if}

			<ol>
				{#each view.current.entries as entry (entry.id)}
					<li class:undone={!entry.applied}>
						<strong>{entry.label}</strong>
						{#if !entry.applied}
							<span class="history-state">Undone</span>
						{/if}

						{#if entry.annotations.length}
							<details>
								<summary>Operations in this edit</summary>

								<ul>
									{#each entry.annotations as annotation}
										<li>
											{annotation.label || "Unlabelled change"}
										</li>
									{/each}
								</ul>
							</details>
						{/if}
					</li>
				{:else}
					<li>No edits in the retained history.</li>
				{/each}
			</ol>
		{/if}
	</details>

	<details class="secondary" bind:open={technicalOpen}>
		<summary>Technical details</summary>

		{#if technicalOpen}
			<p class="explanation">
				Complete save-field differences, including changes already summarised
				above.
			</p>

			{#each view.current.net as patch, index (index)}
				<ReviewRawChange {patch} />
			{/each}

			{#if includeProofs}
				<StudyButton
					disabled={pending.current > 0}
					onclick={() => void reverse()}
				>
					Reverse backpack
				</StudyButton>
			{/if}
		{/if}
	</details>

	{#if error}
		<StudyAlert title="Operation unavailable" tone="danger" live="assertive">
			<p>{error}</p>
		</StudyAlert>
	{/if}
{/if}

<style>
	.review-heading {
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 2px solid #b98b52;
	}
	h1 {
		font-size: 32px;
		margin: 0 0 8px;
	}
	.review-heading p {
		margin: 0;
		color: #694621;
	}
	h2 {
		font-size: 25px;
		margin: 0 0 20px;
	}
	.review-group {
		background: #fff1d2;
		border: 2px solid #c8a371;
		padding: 18px;
		margin-bottom: 20px;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 23px;
		margin: 0 0 14px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: 12px 10px;
		border-top: 1px solid #d5b782;
		overflow-wrap: anywhere;
	}
	th:first-child {
		width: 44%;
		padding-left: 0;
	}
	thead th {
		font-size: 17px;
		font-weight: 400;
		color: #775632;
	}
	tbody th {
		font-weight: 400;
	}
	.context {
		display: block;
		font-size: 17px;
		color: #775632;
		margin-top: 4px;
	}
	.before {
		color: #775632;
	}
	.after {
		color: #351b0e;
	}
	.secondary {
		border-top: 2px solid #b98b52;
		padding-block: 8px;
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		padding-block: 10px;
	}
	.secondary > summary {
		font-size: 23px;
	}
	.explanation,
	.history-state {
		color: #694621;
		font-size: 18px;
	}
	.history-state {
		margin-left: 12px;
	}
	li {
		margin-block: 12px;
		overflow-wrap: anywhere;
	}
	.undone {
		opacity: 0.7;
	}
	.other {
		background: #f7e3bb;
	}
	@media (max-width: 600px) {
		.review-group {
			padding: 14px 10px;
		}
		th,
		td {
			padding: 10px 5px;
			font-size: 18px;
		}
		.context,
		thead th {
			font-size: 16px;
		}
		th:first-child {
			width: 42%;
		}
	}
</style>
