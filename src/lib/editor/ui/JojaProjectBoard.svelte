<script lang="ts">
	import { Result } from "effect";
	import { CCRoom } from "../../communityCenterData.ts";
	import type { CommunityDomain } from "../community-domain.ts";
	import type { CommandResult } from "../command-result.ts";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	let { community }: { community: CommunityDomain } = $props();
	// Keep the game's form order, including the signature in the sixth cell.
	// Room identities still come from the domain rather than a second price table.
	const projectOrder = [
		CCRoom.Vault,
		CCRoom.BoilerRoom,
		CCRoom.CraftsRoom,
		CCRoom.Pantry,
		CCRoom.FishTank,
	];
	const projects = $derived(
		projectOrder.flatMap((id) =>
			community.rooms.filter((room) => room.id === id && room.project),
		),
	);
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
		if (pending) return false;
		pending = true;
		error = "";
		try {
			const result = await action();
			if (!result) return false;
			if (Result.isFailure(result)) {
				error = result.failure.message;
				return false;
			}
			return true;
		} finally {
			pending = false;
		}
	}
	async function changeProject(
		event: Event & { currentTarget: HTMLInputElement },
		room: number,
	) {
		const control = event.currentTarget;
		const target = community;
		const accepted = await perform(() => target.project(room, control.checked));
		// A native toggle precedes the queued commit. Restore the latest committed
		// value on failure/noncompletion, including any intervening history changes.
		const current = community.rooms.find((row) => row.id === room);
		if (!accepted && control.isConnected)
			control.checked =
				current?.restored === true || current?.completed === true;
	}
	async function changeTheater(
		event: Event & { currentTarget: HTMLInputElement },
	) {
		const control = event.currentTarget;
		const target = community;
		const accepted = await perform(() => target.theaterChange(control.checked));
		if (!accepted && control.isConnected) control.checked = community.theater;
	}
</script>

{#if error}
	<div class="project-notice">
		<StudyAlert
			title="Project could not be changed"
			tone="danger"
			live="assertive"
		>
			<p>{error}</p>
		</StudyAlert>
	</div>
{/if}

{#if projects.some((project) => project.completed === undefined)}
	<div class="project-notice">
		<StudyAlert title="Some project progress is unavailable" tone="warning">
			<p>Projects with unsupported saved donation progress cannot be edited.</p>
		</StudyAlert>
	</div>
{/if}

<div class="joja-layout">
	<section class="joja-page" aria-label="Joja development plan">
		<header>
			<div class="logo" aria-hidden="true">Joja *</div>

			<div class="heading">
				<h2>Community Development Projects</h2>

				<div class="town">Pelican Town</div>
			</div>
		</header>

		<div class="projects-grid">
			{#each projects as project (project.id)}
				{@const done = project.restored || project.completed === true}
				<label
					class="project-row"
					title={project.completed === undefined
						? "Status unavailable"
						: project.unlock}
				>
					<input
						type="checkbox"
						checked={done}
						disabled={community.membership !== true ||
							project.completed === undefined ||
							pending}
						aria-label={`${project.project} project complete`}
						onchange={(event) => void changeProject(event, project.id)}
					/>

					<span class="project-name">
						{project.project}
						{#if project.completed === undefined}
							<small class="project-unavailable">Status unavailable</small>
						{/if}
					</span>

					<span class="dots" aria-hidden="true"></span>

					<span class="price">{project.price?.toLocaleString()} g</span>
				</label>
			{/each}

			<div class="project-row prepared">
				Prepared by:
				<span class="signature">Morris</span>
			</div>
		</div>
	</section>

	<p class="plan-note">
		{completed} of 5 projects complete. Prices are for reference; editor changes do
		not spend gold.
	</p>

	<!-- The theater is deliberately separate from the original five-project form;
	     completing the development plan must never buy it implicitly. -->
	<section class="theater" aria-label="Joja Movie Theater">
		<label class="project-row">
			<input
				type="checkbox"
				checked={community.theater}
				disabled={community.membership !== true ||
					pending ||
					(!community.theater && completed !== projects.length)}
				aria-label="Movie Theater project complete"
				onchange={(event) => void changeTheater(event)}
			/>

			<span class="project-name">Movie Theater</span>

			<span class="dots" aria-hidden="true"></span>

			<span class="price">1,000,000 g</span>
		</label>

		{#if !community.theater && completed !== projects.length}
			<p>Available after all five development projects are complete.</p>
		{:else}
			<p>A separate project after the five town improvements.</p>
		{/if}
	</section>
</div>

<style>
	.project-notice {
		margin-bottom: 20px;
	}
	.joja-layout {
		container-type: inline-size;
		max-width: 640px;
		margin-inline: auto;
	}
	.joja-page {
		font-family: monospace;
		font-size: 16px;
		color: #89b7fc;
		background: #fff;
		border: 2px solid #5d5c9b;
		image-rendering: pixelated;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-evenly;
		flex-direction: column;
		gap: 12px;
		margin: 20px 12px;
	}
	.logo {
		font-size: 32px;
		white-space: nowrap;
	}
	.heading {
		min-width: 0;
	}
	.joja-page h2 {
		font: bold 16px/1.35 monospace;
		text-align: center;
		color: #5d5c9b;
		margin: 0;
	}
	.town {
		font-size: 13px;
		border-bottom: 2px solid #89b7fc;
		color: #68788e;
		text-align: center;
		max-width: 150px;
		margin: 8px auto 0;
	}
	.projects-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		color: #5d5c9b;
		border-top: 2px solid #5d5c9b;
	}
	.project-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		min-width: 0;
		min-height: 52px;
		padding: 8px;
		background: #fff;
		border-bottom: 2px solid #89b7fc;
		cursor: pointer;
	}
	.project-row:has(input:disabled) {
		cursor: default;
	}
	.project-row input {
		width: 20px;
		height: 20px;
		flex: none;
		margin: 0;
		accent-color: #5d5c9b;
	}
	.project-row input:focus-visible {
		outline: 3px solid #176fb4;
		outline-offset: 3px;
	}
	.project-unavailable {
		display: block;
		font-size: 11px;
		margin-top: 4px;
	}
	.project-name,
	.price {
		white-space: nowrap;
	}
	.dots {
		border-bottom: 2px dotted #5d5c9b;
		height: 1em;
		flex: 1;
		min-width: 4px;
	}
	.prepared {
		color: #4b73a8;
		cursor: default;
	}
	.signature::before {
		content: "x";
		color: #89b7fc;
		font-family: initial;
		margin-right: 4px;
		font-size: 12px;
	}
	.signature {
		color: #5d5c9b;
		font-size: 24px;
		font-family: "Brush Script MT", cursive;
		border-bottom: 2px solid #89b7fc;
		line-height: 0.8;
		flex: 1;
	}
	.plan-note {
		color: #694621;
		font-size: 18px;
		margin: 12px 0 24px;
	}
	.theater {
		color: #5d5c9b;
		background: #fff;
		border: 2px solid #5d5c9b;
		font: 16px/1.35 monospace;
	}
	.theater p {
		font-size: 13px;
		padding: 12px;
		margin: 0;
	}
	/* Older supported browsers without container queries keep the usable single
	   column form. Enhance only when this form itself has room for paired cells. */
	@container (min-width: 561px) {
		.projects-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.projects-grid .project-row:nth-child(odd) {
			border-right: 2px solid #5d5c9b;
		}
		header {
			flex-direction: row;
			gap: 16px;
			margin: 24px 16px;
		}
		.project-row {
			font-size: 16px;
			gap: 8px;
		}
	}
</style>
