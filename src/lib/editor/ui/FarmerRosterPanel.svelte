<script lang="ts">
	import { Result } from "effect";
	import type { DomainEditPort } from "../field-binding.ts";
	import type { ImmutableView } from "../immutable-view.ts";
	import type { FarmerRosterView } from "../farmer-roster-data.ts";
	import { createFarmerRosterDomain } from "../farmer-roster-domain.ts";
	let {
		model,
		roster,
	}: { model: DomainEditPort; roster: ImmutableView<FarmerRosterView> } =
		$props();
	const domain = $derived(createFarmerRosterDomain(roster, model));
	let dragging = $state<string>();
	let pending = $state(false);
	let error = $state("");
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

<h1>Farmer slots</h1>
<p class="intro">
	The first farmer hosts the save. Drag farmers to exchange slots, or use the
	move buttons. Their belongings and progress move with them; homes and cellars
	stay assigned to their slots. Undo restores the whole reassignment.
</p>
{#if domain.reason}
	<p role="status">{domain.reason}</p>
{/if}
{#if error}
	<p role="alert">{error}</p>
{/if}
<div class="roster" aria-label="Farmer slots">
	{#each domain.players as farmer, index (farmer.position)}
		<article
			aria-label={`${farmer.name} slot`}
			class:dragging={dragging === farmer.farmerId}
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
				<header
					role="group"
					aria-label={`${farmer.name} drag handle`}
					draggable={domain.supported && domain.players.length > 1 && !pending}
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
					<span class="position">{farmer.position}</span>
					<div>
						<h2>{farmer.name}</h2>
						<span>
							{farmer.host ? "Host" : "Farmhand"} · {farmer.farmName} Farm
						</span>
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
					<button
						type="button"
						disabled={pending || !domain.supported || index === 0}
						aria-label={`Move ${farmer.name} up`}
						onclick={() => {
							const other = domain.players[index - 1];
							if (other) void swap(farmer.farmerId, other.farmerId);
						}}
					>
						Move up
					</button>
					<button
						type="button"
						disabled={pending ||
							!domain.supported ||
							index === domain.players.length - 1}
						aria-label={`Move ${farmer.name} down`}
						onclick={() => {
							const other = domain.players[index + 1];
							if (other) void swap(farmer.farmerId, other.farmerId);
						}}
					>
						Move down
					</button>
				</div>
			</div>
		</article>
	{/each}
</div>
{#if domain.players.length < 2}
	<p>This save has one named farmer. There is nobody to exchange slots with.</p>
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
		font-family: "Pixelify Sans", sans-serif;
		font-size: 34px;
		margin: 0 0 12px;
	}
	.intro {
		color: #6b5239;
		max-width: 80ch;
		margin: 0 0 24px;
	}
	.roster {
		display: grid;
		gap: 16px;
		max-width: 900px;
	}
	article {
		border: 1px solid #b58c55;
		border-radius: 10px;
		background: #fff7e5;
		padding: 20px;
		min-width: 0;
	}
	article.dragging {
		opacity: 0.55;
	}
	header {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	header[draggable="true"] {
		cursor: grab;
	}
	h2 {
		margin: 0 0 5px;
		font-size: 24px;
	}
	header div > span,
	dt {
		font-size: 13px;
		color: #6b5239;
	}
	.position {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 22px;
		border-radius: 50%;
		background: #eed2a1;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin: 18px 0;
	}
	dd {
		margin: 4px 0 0;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	button {
		font: inherit;
		padding: 8px 12px;
		background: #efd29a;
		border: 1px solid #ad7d45;
		border-radius: 6px;
		color: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.note {
		color: #6b5239;
		font-size: 13px;
	}
	[role="alert"] {
		color: #9a2c17;
	}
	@media (max-width: 500px) {
		article {
			padding: 16px;
		}
		h1 {
			font-size: 29px;
		}
	}
</style>
