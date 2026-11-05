<script lang="ts">
	import { Result } from "effect";
	import { tick } from "svelte";
	import type { CommunityBundleDomain } from "../community-domain.ts";
	import {
		BUNDLE_QUALITIES,
		MAX_BUNDLE_ITEMS,
		MAX_GOLD,
		MAX_INGREDIENT_STACK,
		canHaveQuality,
		ingredientChoices,
		ingredientName,
		ingredientObject,
	} from "../community-ingredients.ts";
	import StudyDialog from "../../ui/kit/StudyDialog.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import { guidanceItem } from "../item-guidance.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	interface Props {
		bundle: CommunityBundleDomain;
		disabled?: boolean;
	}
	let { bundle, disabled = false }: Props = $props();
	interface DraftRow {
		id: number;
		sourceIndex?: number;
		itemId: string;
		quantity: number;
		quality: number;
	}
	let open = $state(false);
	let busy = $state(false);
	let error = $state("");
	let rows = $state<DraftRow[]>([]);
	let needed = $state(1);
	let adding = $state(false);
	let dragging = $state<number>();
	let dragBlocked = $state(false);
	let dropTarget = $state<number>();
	let announcement = $state("");
	const reorderHelpId = $props.id();
	let search = $state("");
	let nextId = 0;
	let apply: CommunityBundleDomain["editRequirements"];
	const vault = $derived(bundle.room === 4);
	const choices = $derived(
		ingredientChoices
			.filter((row) =>
				`${row.name} ${row.id}`
					.toLowerCase()
					.includes(search.trim().toLowerCase()),
			)
			.slice(0, 40),
	);
	function show(value: boolean) {
		if (value) {
			// This is one coordinated transaction: browsing and cancelling the draft
			// never write the save, and later projection updates do not reset its inputs.
			rows = bundle.requirements.map((row, index) => ({
				id: index,
				sourceIndex: index,
				itemId: row.itemId,
				quantity: row.quantity,
				quality: row.quality,
			}));
			nextId = rows.length;
			needed = bundle.needed;
			apply = bundle.editRequirements;
			error = "";
			adding = false;
			search = "";
		}
		dragging = undefined;
		dropTarget = undefined;
		dragBlocked = false;
		announcement = "";
		open = value;
	}
	function choose(itemId: string) {
		if (rows.length >= MAX_BUNDLE_ITEMS || busy) return;
		// Adding chooses a new requirement; existing names are plain information.
		// Existing rows retain their source index, including when moved or removed.
		rows = [...rows, { id: nextId++, itemId, quantity: 1, quality: 0 }];
		adding = false;
	}
	function moveRow(id: number, destination: number) {
		const index = rows.findIndex((row) => row.id === id);
		const target = Math.max(0, Math.min(rows.length - 1, destination));
		const moving = rows[index];
		if (!moving || index === target || busy) return;
		// Move the entire draft row, not its item fields, so its donation ownership
		// and edited values follow the same requirement through the transaction.
		const reordered = rows.filter((row) => row.id !== id);
		reordered.splice(target, 0, moving);
		rows = reordered;
		announcement = `${ingredientName(moving.itemId)} moved to requirement ${target + 1} of ${rows.length}.`;
	}
	function reorderKey(
		event: KeyboardEvent & { currentTarget: HTMLButtonElement },
		row: DraftRow,
		index: number,
	) {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
		event.preventDefault();
		const handle = event.currentTarget;
		moveRow(row.id, index + (event.key === "ArrowUp" ? -1 : 1));
		// Moving a focused DOM node may reset focus in a browser. Restore the same
		// keyed handle, allowing repeated arrow moves without a keyboard detour.
		void tick().then(() => {
			if (handle.isConnected) handle.focus();
		});
	}
	function prepareDrag(event: PointerEvent) {
		// The row is the drag surface, but selecting a value or using an action
		// must remain a native control gesture rather than moving a requirement.
		dragBlocked =
			event.target instanceof Element &&
			!!event.target.closest("input, select, textarea, button:not(.handle), a");
	}
	function startDrag(event: DragEvent, id: number) {
		if (busy || dragBlocked) {
			event.preventDefault();
			return;
		}
		dragging = id;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", String(id));
		}
	}
	function dragOver(event: DragEvent, id: number) {
		// Only a drag started by this draft may reorder it. External item drags
		// must not invent a new row or borrow another bundle's source identity.
		if (dragging === undefined || busy) return;
		event.preventDefault();
		dropTarget = id;
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
	}
	function drop(event: DragEvent, index: number) {
		if (dragging === undefined || busy) return;
		event.preventDefault();
		moveRow(dragging, index);
		dragging = undefined;
		dropTarget = undefined;
	}
	async function save() {
		if (busy) return;
		busy = true;
		error = "";
		try {
			const requirements = rows.map(({ id: _id, ...row }) => row);
			// The Vault stores price in quality too when that was its imported encoding.
			if (vault) {
				const prior = bundle.requirements.at(-1);
				const last = requirements.at(-1);
				if (prior && last && prior.quantity === prior.quality)
					last.quality = last.quantity;
			}
			const result = await apply(requirements, needed);
			if (!result) return;
			if (Result.isFailure(result)) error = result.failure.message;
			else open = false;
		} finally {
			busy = false;
		}
	}
</script>

<StudyDialog
	trigger="Edit requirements"
	size="wide"
	title={`Edit ${bundle.name} requirements`}
	description="Change what this bundle asks for. Donations stay with their existing rows; this does not spend items or gold."
	bind:open={() => open, show}
	dismissible={!busy}
	disabled={disabled || !bundle.supported}
>
	<fieldset class="draft study-theme" disabled={busy}>
		<legend class="sr-only">Bundle requirements</legend>

		{#if vault}
			<p>Vault bundles are bought with gold. Only the price can change.</p>

			{@const price = rows.at(-1)}
			{#if price}
				<label>
					Price in gold
					<input
						class="study-input"
						type="number"
						min="1"
						max={MAX_GOLD}
						bind:value={price.quantity}
					/>
				</label>
			{/if}
		{:else}
			<p class="sr-only" id={reorderHelpId}>
				Drag a row to reorder, or focus its handle and press Arrow Up or Arrow
				Down.
			</p>
			<p class="sr-only" role="status">{announcement}</p>
			<div class="rows">
				{#each rows as row, index (row.id)}
					{@const object = ingredientObject(row.itemId)}
					<div
						class="ingredient"
						class:drop-target={dropTarget === row.id && dragging !== row.id}
						role="group"
						draggable={!busy && !dragBlocked}
						onpointerdown={prepareDrag}
						ondragstart={(event) => startDrag(event, row.id)}
						ondragend={() => {
							dragging = undefined;
							dropTarget = undefined;
							dragBlocked = false;
						}}
						aria-label={`Requirement ${index + 1}: ${ingredientName(row.itemId)}`}
						ondragover={(event) => dragOver(event, row.id)}
						ondrop={(event) => drop(event, index)}
					>
						<button
							type="button"
							class="handle"
							aria-label={`Reorder requirement ${index + 1}: ${ingredientName(row.itemId)}`}
							aria-describedby={reorderHelpId}
							aria-keyshortcuts="ArrowUp ArrowDown"
							onkeydown={(event) => reorderKey(event, row, index)}
						>
							<svg
								width="10"
								height="17"
								viewBox="0 0 10 17"
								aria-hidden="true"
							>
								<path
									fill="currentColor"
									d="M0 0h3v3H0zM7 0h3v3H7zM0 7h3v3H0zM7 7h3v3H7zM0 14h3v3H0zM7 14h3v3H7z"
								/>
							</svg>
						</button>

						<div class="identity">
							<BackpackItemVisual
								visual={object ? guidanceItem(object.name).visual : undefined}
							/>
							<span>{ingredientName(row.itemId)}</span>
						</div>

						<label class="amount">
							Quantity
							<input
								class="study-input"
								type="number"
								min="1"
								max={MAX_INGREDIENT_STACK}
								bind:value={row.quantity}
								aria-label={`Quantity for requirement ${index + 1}`}
							/>
						</label>

						<label class="quality">
							Minimum quality
							<select
								class="study-input"
								bind:value={row.quality}
								aria-label={`Minimum quality for requirement ${index + 1}`}
							>
								{#each [...BUNDLE_QUALITIES] as [quality, label] (quality)}
									<option
										value={quality}
										disabled={quality > 0 && !canHaveQuality(row.itemId)}
									>
										{label}
									</option>
								{/each}
								{#if !BUNDLE_QUALITIES.has(row.quality)}
									<option value={row.quality}>
										Imported quality {row.quality}
									</option>
								{/if}
							</select>
						</label>

						<StudyButton
							intent="destructive"
							class="remove"
							disabled={rows.length === 1}
							aria-label={`Remove requirement ${index + 1}`}
							onclick={() => {
								rows = rows.filter((item) => item.id !== row.id);
								needed = Math.min(needed, rows.length);
							}}
						>
							Remove
						</StudyButton>
					</div>
				{/each}
			</div>

			{#if adding}
				<section class="picker" aria-label="Add a bundle requirement">
					<label>
						Search items or categories
						<input class="study-input" type="search" bind:value={search} />
					</label>

					<div class="choices">
						{#each choices as choice (choice.id)}
							{@const object = ingredientObject(choice.id)}
							<button
								type="button"
								class="study-button"
								onclick={() => choose(choice.id)}
							>
								<BackpackItemVisual
									visual={object ? guidanceItem(object.name).visual : undefined}
								/>
								{choice.name}
							</button>
						{/each}
					</div>

					{#if !choices.length}<p>No matching items.</p>{/if}
					<p>Showing up to 40 matches. Search to narrow the list.</p>
				</section>
			{/if}

			<div class="controls">
				<StudyButton
					disabled={rows.length >= MAX_BUNDLE_ITEMS}
					onclick={() => {
						adding = !adding;
						search = "";
					}}
				>
					Add requirement
				</StudyButton>

				<label>
					Donations needed
					<input
						class="study-input"
						type="number"
						min="1"
						max={rows.length}
						bind:value={needed}
					/>
				</label>
			</div>
		{/if}
	</fieldset>

	<p class="note">
		An edit cannot finish or reopen the bundle. Change its donations separately
		first.
	</p>

	{#if error}
		<StudyAlert
			title="Requirements could not be changed"
			tone="danger"
			live="assertive"
		>
			<p>{error}</p>
		</StudyAlert>
	{/if}

	{#snippet actions(close)}
		<StudyButton onclick={close} disabled={busy}>Cancel</StudyButton>

		<StudyButton
			intent="constructive"
			variant="filled"
			pending={busy}
			onclick={() => void save()}
		>
			Apply requirements
		</StudyButton>
	{/snippet}
</StudyDialog>

<style>
	.draft {
		border: 0;
		padding: 0;
		min-width: 0;
	}
	.draft label {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.rows {
		display: grid;
		gap: 12px;
	}
	.ingredient {
		cursor: grab;
		display: grid;
		grid-template-columns:
			28px minmax(120px, 2fr) minmax(70px, 1fr) minmax(100px, 1fr)
			auto;
		gap: 10px;
		align-items: end;
		border-bottom: 1px solid var(--study-border, #b98b52);
		padding-bottom: 12px;
	}
	/* Paint the drop marker inside the row so dragging cannot shift neighbours. */
	.ingredient input {
		cursor: text;
	}
	.ingredient select {
		cursor: default;
	}
	.ingredient.drop-target {
		box-shadow: inset 0 -2px 0 var(--study-accent, #4c7029);
	}
	.identity {
		display: flex;
		gap: 8px;
		align-items: center;
		min-width: 0;
		min-height: 42px;
		overflow-wrap: anywhere;
	}
	.handle {
		display: grid;
		place-items: center;
		cursor: grab;
		font: inherit;
		font-size: 24px;
		min-height: 42px;
		padding: 0;
		color: var(--study-muted, #815327);
		border: 0;
		background: transparent;
	}
	.handle:active {
		cursor: grabbing;
	}
	.handle:focus-visible {
		outline: 2px solid var(--study-border, #b98b52);
		outline-offset: 2px;
	}
	.controls {
		display: flex;
		gap: 16px;
		align-items: end;
		flex-wrap: wrap;
		margin-top: 16px;
	}
	.controls input {
		max-width: 110px;
	}
	.picker {
		border: 2px solid #b98b52;
		padding: 12px;
		margin: 16px 0;
		background: #fff5df;
	}
	.choices {
		max-height: 220px;
		overflow: auto;
		scrollbar-gutter: stable;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 6px;
		margin-top: 10px;
	}
	.choices button {
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
	}
	.note {
		font-size: 17px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (max-width: 640px) {
		.ingredient {
			grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr);
			gap: 8px;
		}
		.handle {
			grid-column: 1;
			grid-row: 1;
		}
		.identity {
			grid-column: 2 / -1;
			grid-row: 1;
		}
		.amount {
			grid-column: 2;
			grid-row: 2;
		}
		.quality {
			grid-column: 3;
			grid-row: 2;
		}
		.ingredient :global(.remove) {
			grid-column: 2 / -1;
			justify-self: end;
		}
	}
</style>
