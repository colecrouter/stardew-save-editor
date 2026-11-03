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
							iconOnly
							title="Move up"
							aria-label={`Move ${farmer.name} up`}
							onclick={() => {
								const other = domain.players[index - 1];
								if (other) void swap(farmer.farmerId, other.farmerId);
							}}
						>
							<span aria-hidden="true">↑</span>
						</StudyButton>

						<StudyButton
							disabled={pending ||
								!domain.supported ||
								index === domain.players.length - 1}
							iconOnly
							title="Move down"
							aria-label={`Move ${farmer.name} down`}
							onclick={() => {
								const other = domain.players[index + 1];
								if (other) void swap(farmer.farmerId, other.farmerId);
							}}
						>
							<span aria-hidden="true">↓</span>
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
		margin: 0 0 20px;
	}
	.roster {
		display: grid;
		gap: 10px;
		max-width: 1000px;
		margin-bottom: 20px;
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
	/* Identity and statistics share one row; the action rail touches the card's
    outer edges rather than reserving a separate padded button row. */
	.drop-target {
		display: grid;
		grid-template-columns: 76px minmax(140px, 0.8fr) minmax(240px, 1fr) 44px;
		gap: 12px;
		align-items: center;
	}
	.record {
		display: contents;
	}
	.farmer-preview {
		--appearance-scale: 2;
		min-width: 0;
		margin: 8px 0 8px 8px;
	}
	.farmer-preview :global(.preview) {
		min-height: 92px;
		padding: 6px;
	}
	.preview-unavailable {
		display: grid;
		place-items: center;
		min-height: 92px;
		border: 2px solid #b98b52;
		background: #f5dbab;
		color: #694621;
		text-align: center;
		font-size: 14px;
	}
	header {
		min-width: 0;
		padding: 8px 0;
	}
	header[draggable="true"] {
		cursor: grab;
	}
	.position {
		color: #79522d;
		font-size: 16px;
		margin: 0 0 4px;
	}
	h2 {
		margin: 0 0 4px;
		font-size: 24px;
		overflow-wrap: anywhere;
	}
	.farm-name {
		color: #694621;
		font-size: 16px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		margin: 0;
		padding: 8px 0;
		min-width: 0;
	}
	dl > div {
		min-width: 0;
	}
	dt {
		font-size: 16px;
		color: #79522d;
	}
	dd {
		font-size: 18px;
		margin: 2px 0 0;
		overflow-wrap: anywhere;
	}
	.actions {
		display: grid;
		grid-template-rows: 1fr 1fr;
		align-self: stretch;
		border-left: 1px solid #b98b52;
	}
	.actions :global(button) {
		width: 44px;
		height: 100%;
		min-height: 44px;
		border: 0;
		border-radius: 0;
		box-shadow: none;
	}
	.actions :global(button + button) {
		border-top: 1px solid #b98b52;
	}
	.note {
		color: #694621;
		font-size: 17px;
		line-height: 1.4;
	}
	@media (max-width: 900px) {
		/* Keep both actions flush while allowing statistics to wrap under identity.
     The full-body preview spans those two rows without adding vertical space. */
		.drop-target {
			grid-template-columns: 76px minmax(0, 1fr) 44px;
			gap: 0 12px;
		}
		.farmer-preview {
			grid-row: 1 / 3;
		}
		header {
			grid-column: 2;
			padding-bottom: 0;
		}
		dl {
			grid-column: 2;
			padding-top: 6px;
		}
		.actions {
			grid-column: 3;
			grid-row: 1 / 3;
		}
	}
	@media (max-width: 480px) {
		h1 {
			font-size: 28px;
		}
		.drop-target {
			gap: 0 8px;
		}
		h2 {
			font-size: 22px;
		}
		dl {
			gap: 6px 12px;
		}
		dt {
			font-size: 14px;
		}
		dd {
			font-size: 16px;
		}
	}
</style>
