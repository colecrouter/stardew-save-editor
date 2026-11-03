<script lang="ts">
	import { Result } from "effect";
	import type { DomainEditPort } from "../field-binding.ts";
	import type { ImmutableView } from "../immutable-view.ts";
	import type { FarmerRosterView } from "../farmer-roster-data.ts";
	import { createFarmerRosterDomain } from "../farmer-roster-domain.ts";
	import type { AppearanceView } from "../appearance-operations.ts";
	import AppearancePreview from "./AppearancePreview.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	let {
		model,
		roster,
		appearances,
	}: {
		model: DomainEditPort;
		roster: ImmutableView<FarmerRosterView>;
		appearances: readonly ImmutableView<AppearanceView>[];
	} = $props();
	const domain = $derived(createFarmerRosterDomain(roster, model));
	let dragging = $state<string>();
	let pending = $state(false);
	let error = $state("");
	function previewFor(farmerId: string) {
		// Match by identity rather than slot: a promotion moves the farmer's look
		// with their progress. Ambiguous imported identities must not pick a winner.
		const matches = appearances.filter(
			(farmer) => farmer.farmerId === farmerId,
		);
		return matches.length === 1 ? matches[0]?.preview : undefined;
	}
	async function swap(source: string, target: string) {
		if (pending || !domain.supported || source === target) return;
		pending = true;
		error = "";
		dragging = undefined;
		try {
			const result = await domain.swap(source, target);
			if (result && Result.isFailure(result)) error = result.failure.message;
		} finally {
			pending = false;
		}
	}
</script>

<h1>Farmhands</h1>
<p class="intro">Your farmers, their homes, and who hosts the save.</p>

{#if domain.reason}
	<StudyAlert title="Farmer slots unavailable" tone="warning">
		<p>{domain.reason}</p>
	</StudyAlert>
{/if}

{#if error}
	<StudyAlert title="Reassignment unavailable" tone="danger" live="assertive">
		<p>{error}</p>
	</StudyAlert>
{/if}

<div class="roster" aria-label="Farmer slots" aria-busy={pending}>
	{#each domain.players as farmer, index (farmer.position)}
		{@const preview = previewFor(farmer.farmerId)}
		<article
			aria-label={`${farmer.name} slot`}
			class:dragging={dragging === farmer.farmerId}
			class:host={farmer.host}
		>
			<div
				class="drop-target"
				role="group"
				aria-label={`Exchange with ${farmer.name}`}
				ondragover={(event) => {
					if (dragging && !pending && domain.supported) event.preventDefault();
				}}
				ondrop={(event) => {
					event.preventDefault();
					if (dragging) void swap(dragging, farmer.farmerId);
				}}
			>
				<div class="farmer-preview">
					{#if preview}
						<AppearancePreview {preview} />
					{:else}
						<div class="preview-unavailable">Preview unavailable</div>
					{/if}
				</div>

				<div class="record">
					<header
						role="group"
						aria-label={`${farmer.name} drag handle`}
						draggable={domain.supported &&
							domain.players.length > 1 &&
							!pending}
						ondragstart={(event) => {
							dragging = farmer.farmerId;
							event.dataTransfer?.setData(
								"application/x-stardew-farmer",
								farmer.farmerId,
							);
						}}
						ondragend={() => {
							dragging = undefined;
						}}
					>
						<div class="identity">
							<p class="position">
								Slot {farmer.position} · {farmer.host ? "Host" : "Farmhand"}
							</p>
							<h2 data-sentry-mask="">{farmer.name}</h2>
							<p class="farm-name" data-sentry-mask="">
								{farmer.farmName} Farm
							</p>
						</div>

						<span class="role-note">
							{farmer.host ? "Hosts this save" : "Joins the host's farm"}
						</span>
					</header>

					<dl>
						<div>
							<dt>Home slot</dt>
							<dd>{farmer.home}</dd>
						</div>
						{#if farmer.played}
							<div>
								<dt>Time played</dt>
								<dd>{farmer.played}</dd>
							</div>
						{/if}
						{#if farmer.moneyEarned !== undefined}
							<div>
								<dt>Lifetime earnings</dt>
								<dd>{farmer.moneyEarned.toLocaleString()}g</dd>
							</div>
						{/if}
					</dl>

					<div class="actions">
						<StudyButton
							disabled={pending || !domain.supported || index === 0}
							aria-label={`Move ${farmer.name} up`}
							onclick={() => {
								const other = domain.players[index - 1];
								if (other) void swap(farmer.farmerId, other.farmerId);
							}}
						>
							<span aria-hidden="true">↑</span>
							Move up
						</StudyButton>

						<StudyButton
							disabled={pending ||
								!domain.supported ||
								index === domain.players.length - 1}
							aria-label={`Move ${farmer.name} down`}
							onclick={() => {
								const other = domain.players[index + 1];
								if (other) void swap(farmer.farmerId, other.farmerId);
							}}
						>
							<span aria-hidden="true">↓</span>
							Move down
						</StudyButton>
					</div>
				</div>
			</div>
		</article>
	{/each}
</div>

<StudyAside title="Reassigning farmer slots">
	<p>
		Drag a farmer's name onto another card, or use Move up and Move down. Their
		belongings and progress move with them; homes and cellars stay with their
		slots. One Undo restores the whole exchange.
	</p>
</StudyAside>

{#if domain.players.length < 2}
	<p class="note">
		This save has one named farmer. There is nobody to exchange slots with.
	</p>
{/if}

{#if domain.placeholders > 0}
	<p class="note">
		{domain.placeholders} unclaimed cabin {domain.placeholders === 1
			? "placeholder stays"
			: "placeholders stay"} in the original saved slots.
	</p>
{/if}

<style>
	h1 {
		font-size: 32px;
		margin: 0 0 8px;
	}
	.intro {
		color: #694621;
		margin: 0 0 24px;
	}
	.roster {
		display: grid;
		gap: 12px;
		max-width: 1050px;
		margin-bottom: 22px;
	}
	article {
		border: 2px solid #b98b52;
		background: #fff1d2;
		min-width: 0;
	}
	article.host {
		border-color: #815126;
	}
	article.dragging {
		opacity: 0.55;
	}
	.drop-target {
		display: grid;
		grid-template-columns: 100px minmax(0, 1fr);
		gap: 16px;
		padding: 14px;
	}
	.farmer-preview {
		/* Integer scaling keeps the smaller full-body portrait pixel sharp. */
		--appearance-scale: 3;
		min-width: 0;
	}
	.farmer-preview :global(.preview) {
		min-height: 136px;
		padding: 10px;
	}
	.preview-unavailable {
		display: grid;
		place-items: center;
		min-height: 136px;
		border: 2px solid #b98b52;
		background: #f5dbab;
		color: #694621;
		text-align: center;
		padding: 16px;
		box-sizing: border-box;
	}
	.record {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid #d5b782;
	}
	header[draggable="true"] {
		cursor: grab;
	}
	.identity {
		min-width: 0;
	}
	.position {
		color: #79522d;
		font-size: 17px;
		margin: 0 0 4px;
	}
	h2 {
		margin: 0 0 6px;
		font-size: 24px;
		overflow-wrap: anywhere;
	}
	.farm-name {
		color: #694621;
		font-size: 17px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.role-note {
		color: #79522d;
		font-size: 16px;
		text-align: right;
		max-width: 150px;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin: 10px 0;
	}
	dt {
		font-size: 16px;
		color: #79522d;
	}
	dd {
		font-size: 20px;
		margin: 2px 0 0;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: auto;
	}
	.note {
		color: #694621;
		font-size: 17px;
		line-height: 1.4;
	}
	@media (max-width: 1100px) {
		.drop-target {
			grid-template-columns: 100px minmax(0, 1fr);
		}
		dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.role-note {
			display: none;
		}
	}
	@media (max-width: 600px) {
		h1 {
			font-size: 28px;
		}
		.drop-target {
			grid-template-columns: 76px minmax(0, 1fr);
			padding: 12px;
			gap: 12px;
		}
		.farmer-preview {
			--appearance-scale: 2;
		}
		.farmer-preview :global(.preview) {
			min-height: 100px;
			padding: 8px;
		}
		.record {
			display: contents;
		}
		header {
			gap: 12px;
		}
		h2 {
			font-size: 24px;
		}
		dl {
			grid-column: 1 / -1;
			margin: 0;
			gap: 12px;
		}
		dd {
			font-size: 18px;
		}
		.actions {
			grid-column: 1 / -1;
		}
		.actions :global(button) {
			flex: 1 1 auto;
		}
	}
</style>
