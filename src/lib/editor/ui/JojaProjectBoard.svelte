<script lang="ts">
	import { Result } from "effect";
	import type { CommunityDomain } from "../community-domain.ts";
	import type { CommandResult } from "../command-result.ts";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	let { community }: { community: CommunityDomain } = $props();
	const projects = $derived(community.rooms.filter((room) => room.project));
	// Bought projects and completed donations share restoration progress. Either
	// known completion grants the benefit; absent donation data stays unavailable.
	const completed = $derived(
		projects.filter((room) => room.restored || room.completed === true).length,
	);
	let pending = $state(false);
	let error = $state("");
	async function perform(
		action: () => Promise<CommandResult<unknown, { message: string }>>,
	) {
		// Keep coordinated project changes serial while the session commits them.
		if (pending) return;
		pending = true;
		error = "";
		try {
			const result = await action();
			if (result && Result.isFailure(result)) error = result.failure.message;
		} finally {
			pending = false;
		}
	}
</script>

{#if community.membership !== true}
	<div class="membership-note">
		<StudyAlert
			title={community.membership === false
				? "Joja membership required"
				: "Membership could not be read"}
			tone="info"
		>
			<p>
				{community.membership === false
					? "You can inspect the development plan here. Use Enable Joja above to change membership before editing projects."
					: "The saved membership is unsupported. Project edits are unavailable."}
			</p>
		</StudyAlert>
	</div>
{/if}

{#if error}
	<div class="membership-note">
		<StudyAlert
			title="Project could not be changed"
			tone="danger"
			live="assertive"
		>
			<p>{error}</p>
		</StudyAlert>
	</div>
{/if}

<section class="joja-plan" aria-label="Joja development plan">
	<header>
		<div class="joja-brand" aria-hidden="true">
			Joja
			<svg width="24" height="24" viewBox="0 0 24 24">
				<path d="m12 0 3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="currentColor" />
			</svg>
		</div>

		<div>
			<h2>Joja Community Development</h2>

			<p>Pelican Town</p>
		</div>
	</header>

	<div class="plan-status">
		<span>{completed} of {projects.length} projects complete</span>

		<span>In-game cost</span>
	</div>

	{#each projects as project (project.id)}
		{@const done = project.restored || project.completed === true}
		<article
			class="project"
			class:complete={done}
			aria-label={`${project.project} project`}
		>
			<div class="project-copy">
				<h3>{project.project}</h3>

				<p>{project.unlock}</p>

				{#if project.completed === undefined}
					<p>
						Saved donation progress is unavailable; this project cannot be
						edited.
					</p>
				{/if}

				<span class="project-state">
					{done
						? "Completed"
						: project.completed === undefined
							? "Status unavailable"
							: "Not completed"}
				</span>
			</div>

			<span class="price">{project.price?.toLocaleString()}g</span>

			<StudyButton
				intent={done ? "neutral" : "constructive"}
				disabled={community.membership !== true ||
					project.completed === undefined ||
					pending}
				aria-label={`${done ? "Reopen" : "Complete"} ${project.project} project`}
				onclick={() => {
					const target = community;
					void perform(() => target.project(project.id, !done));
				}}
			>
				{done ? "Reopen project" : "Complete project"}
			</StudyButton>
		</article>
	{/each}

	<section class="theater" aria-label="Joja Movie Theater">
		<div class="theater-heading">
			<div>
				<h3>Movie Theater</h3>

				<p>A separate project after the five town improvements.</p>
			</div>

			<span class="price">1,000,000g</span>
		</div>

		{#if !community.theater && completed !== projects.length}
			<p class="theater-note">
				Complete all five projects to make the theater available.
			</p>
		{/if}

		<StudyButton
			intent={community.theater ? "neutral" : "constructive"}
			disabled={community.membership !== true ||
				pending ||
				(!community.theater && completed !== projects.length)}
			onclick={() => {
				const target = community;
				void perform(() => target.theaterChange(!target.theater));
			}}
		>
			{community.theater ? "Reopen theater project" : "Build Movie Theater"}
		</StudyButton>
	</section>

	<footer>
		Prices are shown for reference. Editor changes do not spend gold.
	</footer>
</section>

<style>
	.membership-note {
		margin-bottom: 20px;
	}
	.joja-plan {
		min-width: 0;
		color: #244664;
		background: #f1f7f7;
		border: 2px solid #547fa3;
	}
	header {
		display: flex;
		align-items: center;
		gap: 28px;
		padding: 24px;
		border-bottom: 2px solid #547fa3;
		background: #dcebf5;
	}
	.joja-brand {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
		font:
			42px/1 "Pixelify Sans",
			sans-serif;
		color: #306d9e;
	}
	h2 {
		font-size: 25px;
		margin: 0;
	}
	header p {
		margin: 8px 0 0;
		font-size: 18px;
	}
	.plan-status {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 24px;
		font-size: 18px;
		border-bottom: 1px solid #a0bcd0;
	}
	.project {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 20px;
		padding: 20px 24px;
		border-bottom: 1px solid #a0bcd0;
	}
	.project.complete {
		background: #e1ede8;
	}
	h3 {
		font-size: 23px;
		margin: 0;
	}
	.project-copy p,
	.theater p {
		margin: 6px 0 0;
		font-size: 18px;
	}
	.project-state {
		display: inline-block;
		margin-top: 8px;
		font-size: 17px;
	}
	.price {
		white-space: nowrap;
		font-size: 22px;
		font-variant-numeric: tabular-nums;
	}
	.theater {
		padding: 24px;
	}
	.theater-heading {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		justify-content: space-between;
		margin-bottom: 16px;
	}
	.theater-note {
		margin-bottom: 16px !important;
	}
	footer {
		padding: 16px 24px;
		border-top: 2px solid #547fa3;
		background: #dcebf5;
		font-size: 18px;
	}
	@media (max-width: 1200px) {
		.project {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.project :global(.study-button) {
			grid-column: 1 / -1;
			justify-self: start;
		}
	}
	@media (max-width: 600px) {
		header {
			align-items: start;
			flex-direction: column;
			gap: 16px;
			padding: 20px 16px;
		}
		h2 {
			font-size: 23px;
		}
		.project,
		.theater {
			padding: 20px 16px;
		}
		.plan-status,
		footer {
			padding-inline: 16px;
		}
		.plan-status span:last-child {
			display: none;
		}
		.price {
			font-size: 20px;
		}
		.project :global(.study-button) {
			width: 100%;
		}
	}
</style>
