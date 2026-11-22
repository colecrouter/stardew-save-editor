<script lang="ts">
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
	import type { CollectionEntry } from "../collection-fields.ts";
	import { collectionPresentation } from "../collection-presentation.ts";
	import type { EditorModel } from "../editor-model.ts";
	import type { ImmutableView } from "../immutable-view.ts";
	import type { ProgressFarmer } from "../progress-data.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import CollectionRow from "./CollectionRow.svelte";
	import ProgressMeter from "./ProgressMeter.svelte";

	let {
		model,
		farmer,
		kind,
	}: {
		model: EditorModel;
		farmer: ImmutableView<ProgressFarmer> | undefined;
		kind: "shipping" | "fishing";
	} = $props();
	let search = $state("");
	let filter = $state("all");
	let limit = $state(24);
	let otherLimit = $state(24);
	let focused = $state<string>();
	const farmerId = $derived(farmer?.farmerId);

	// Keep search and filter across farmers. Paging and the focused card belong
	// to the selected farmer, so reset them when that farmer's ID changes.
	$effect(() => {
		void farmerId;
		limit = 24;
		otherLimit = 24;
		focused = undefined;
	});

	const title = $derived(
		kind === "shipping" ? "Shipping collection" : "Fishing collection",
	);
	const entries: CollectionEntry[] = $derived(
		kind === "shipping"
			? (farmer?.shipments ?? []).map((row) => ({
					...row,
					reason: row.ambiguous
						? "This item has duplicate shipment records."
						: undefined,
				}))
			: [...(farmer?.fishing ?? [])],
	);
	const recorded = $derived(entries.filter((row) => row.recorded).length);
	const readOnly = $derived(
		entries.filter((row) => row.reason !== undefined).length,
	);
	// Keep catalog order stable. Pin a focused card when its membership changes
	// under Missing/Recorded filters so the first digit cannot unmount its input.
	// Releasing focus reapplies the chosen filter; search always covers all entries.
	const rows = $derived(
		entries.filter(
			(row) =>
				`${row.name} ${row.id}`
					.toLowerCase()
					.includes(search.trim().toLowerCase()) &&
				(filter === "all" ||
					focused === `${farmerId}:${row.id}` ||
					(filter === "recorded" ? row.recorded : !row.recorded)),
		),
	);
	const shown = $derived(rows.slice(0, limit));
	// Outside-catalog records never inflate the collection total. Keep their exact
	// saved order (including duplicate keys) and resolve only display hints here.
	const other = $derived(
		(kind === "shipping" ? (farmer?.otherShipments ?? []) : [])
			.map((row) => ({ ...row, presentation: collectionPresentation(row.id) }))
			.filter((row) =>
				`${row.presentation.name ?? ""} ${row.id}`
					.toLowerCase()
					.includes(search.trim().toLowerCase()),
			),
	);
</script>

<section
	class="collection"
	aria-label={title}
>
	<div class="collection-heading">
		<h2>{title}</h2>

		<p>
			{kind === "shipping"
				? "Produce, forage and other collection items"
				: "Your fishing collection"} · {farmer?.name ?? "Choose a farmer"}
		</p>
	</div>

	{#if entries.length > 0}
		<div
			class="overview"
			aria-label={`${title} summary`}
		>
			<div class="totals">
				<strong>{recorded} / {entries.length} recorded</strong>

				<span>
					{entries.length - recorded} missing{readOnly
						? ` · ${readOnly} read-only`
						: ""}
				</span>
			</div>

			<ProgressMeter
				label={`${title} recorded items`}
				value={recorded}
				max={entries.length}
			/>
		</div>
	{/if}

	<details class="help">
		<summary>
			How {kind === "shipping" ? "shipping" : "fishing"} progress works
		</summary>

		<p>
			{#if kind === "shipping"}
				This list covers the vanilla shipping collection, not every item you can
				sell. Other saved shipments appear separately below and do not count
				toward this total.
			{:else}
				Positive count edits preserve the saved largest size. A new record
				starts at size 0. Removing a record also removes its size; Undo restores
				both.
			{/if}
		</p>

		<p>
			Recorded means a collection entry exists, even if its imported count is
			zero. Checking Recorded starts a missing entry at 1; unchecking it or
			entering 0 removes the entry. Duplicate or unsupported records stay
			read-only. This summary counts saved records, not verified achievement
			requirements.
		</p>

		<p>
			Edits do not replay gameplay, grant awards or deliver rewards.
			{kind === "shipping"
				? "They do not sell items or add income."
				: "They do not update the separate lifetime fish stat or complete quests."}
			The game may check awards and rewards during later gameplay.
		</p>
	</details>

	{#if entries.length > 0 && farmer}
		<div class="toolbar">
			<StudyField
				label={kind === "shipping" ? "Find a shipping item" : "Find a fish"}
			>
				{#snippet children(attributes)}
					<input
						{...attributes}
						type="search"
						class="study-input"
						placeholder="Item name or ID"
						value={search}
						oninput={(event) => {
							search = event.currentTarget.value;
							limit = 24;
							otherLimit = 24;
							focused = undefined;
						}}
					/>
				{/snippet}
			</StudyField>

			<StudyField label="Show collection items">
				{#snippet children(attributes)}
					<select
						{...attributes}
						class="study-input"
						value={filter}
						onchange={(event) => {
							filter = event.currentTarget.value;
							limit = 24;
							focused = undefined;
						}}
					>
						<option value="all">All items</option>
						<option value="missing">Missing</option>
						<option value="recorded">Recorded</option>
					</select>
				{/snippet}
			</StudyField>

			<span role="status">{rows.length} matching items</span>
		</div>

		<!-- Owner keys reset field controllers without discarding this tab's search. -->
		{#key farmer.farmerId}
			<div class="items">
				{#each shown as row (row.id)}
					<CollectionRow
						{model}
						farmerId={farmer.farmerId}
						{kind}
						{row}
						onediting={(active) => {
							focused = active ? `${farmerId}:${row.id}` : undefined;
						}}
					/>
				{:else}
					<p class="empty">
						No collection items match. Try another name or filter.
					</p>
				{/each}
			</div>
		{/key}

		{#if rows.length > shown.length}
			<StudyButton onclick={() => (limit += 24)}>
				Show more items ({rows.length - shown.length} remaining)
			</StudyButton>
		{/if}
	{:else}
		<p>
			Choose a farmer with a readable {kind === "shipping"
				? "shipment"
				: "fishing"} collection.
		</p>
	{/if}

	{#if kind === "shipping" && (farmer?.otherShipments.length ?? 0) > 0}
		<details class="other">
			<summary>
				Other recorded shipments ({farmer?.otherShipments.length})
			</summary>

			<p>
				Saved entries outside the vanilla collection. Preserved as imported and
				read-only; search applies here too.
			</p>

			<ul>
				{#each other.slice(0, otherLimit) as row, index (`${index}:${row.id}`)}
					<li>
						<BackpackItemVisual visual={row.presentation.visual} />

						<div>
							<strong>{row.presentation.name ?? "Unknown item"}</strong>
							<small>Item ID: {row.id}</small>
						</div>

						<span>{row.count} shipped</span>
					</li>
				{:else}
					<li>No other recorded shipments match this search.</li>
				{/each}
			</ul>

			{#if other.length > otherLimit}
				<StudyButton onclick={() => (otherLimit += 24)}>
					Show more other shipments
				</StudyButton>
			{/if}
		</details>
	{/if}
</section>

<style>
	.collection {
		margin-top: 16px;
	}
	.collection-heading h2 {
		margin: 0;
		font-size: 25px;
	}
	.collection-heading p {
		margin: 4px 0 12px;
		color: #694621;
	}
	.overview {
		padding: 12px;
		border: 1px solid #b98b52;
		background: #fff1d2;
	}
	.totals {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.totals span,
	.help,
	.other > p {
		color: #694621;
		font-size: 17px;
	}
	.help {
		margin: 8px 0 12px;
	}
	summary {
		cursor: pointer;
		padding: 6px 0;
	}
	summary:focus-visible {
		outline: 2px solid #754522;
		outline-offset: 2px;
	}
	.help p {
		max-width: 760px;
		line-height: 1.4;
	}
	.toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(150px, 220px) auto;
		align-items: end;
		gap: 12px;
	}
	.toolbar [role="status"] {
		color: #694621;
		font-size: 16px;
		padding-bottom: 10px;
	}
	.items {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		margin: 12px 0;
		align-items: start;
	}
	.empty {
		grid-column: 1 / -1;
	}
	.other {
		margin-top: 20px;
		border-top: 1px solid #b98b52;
		padding-top: 8px;
	}
	.other ul {
		list-style: none;
		margin: 12px 0;
		padding: 0;
	}
	.other li {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 10px 0;
		border-top: 1px solid #b98b5255;
	}
	.other li div {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.other small {
		display: block;
		color: #694621;
	}
	@media (max-width: 1279px) {
		.items {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 700px) {
		.items {
			grid-template-columns: minmax(0, 1fr);
		}
		.toolbar {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.toolbar [role="status"] {
			grid-column: 1 / -1;
			padding-bottom: 0;
		}
	}
	@media (max-width: 480px) {
		.toolbar {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
