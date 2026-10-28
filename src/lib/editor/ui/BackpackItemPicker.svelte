<script lang="ts">
	import { searchCatalog, type CatalogEntry } from "../item-catalog.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";

	interface Props {
		slot: number;
		inventoryKind?: "backpack" | "chest";
		entries: readonly CatalogEntry[];
		onadd: (id: string) => Promise<boolean>;
		oncancel?: () => void;
		error?: string;
	}
	let {
		slot,
		entries,
		onadd,
		oncancel,
		error,
		inventoryKind = "backpack",
	}: Props = $props();
	const id = $props.id();
	let query = $state("");
	let kind = $state("all");
	let page = $state(0);
	let selectedId = $state<string>();
	let saving = $state(false);
	let searchInput = $state<HTMLInputElement>();
	let itemList = $state<HTMLDivElement>();
	const pageSize = 48;
	const kindLabels: Record<string, string> = {
		Object: "Objects",
		BigCraftable: "Craftables",
		Boots: "Boots",
		Furniture: "Furniture",
		Hat: "Hats",
		Mannequin: "Mannequins",
		Pants: "Pants",
		Shirt: "Shirts",
		Tool: "Tools",
		Trinket: "Trinkets",
		Weapon: "Weapons",
	};
	const kinds = $derived(
		[...new Set(entries.map((entry) => entry.kind))].sort((a, b) =>
			(kindLabels[a] ?? a).localeCompare(kindLabels[b] ?? b),
		),
	);
	// Share name/ID matching and ranking with catalog callers, while pagination
	// keeps every match reachable without rendering the entire catalog at once.
	const results = $derived(searchCatalog(query, kind, entries));
	const pages = $derived(Math.max(1, Math.ceil(results.length / pageSize)));
	const currentPage = $derived(Math.min(page, pages - 1));
	const start = $derived(currentPage * pageSize);
	const visible = $derived(results.slice(start, start + pageSize));
	// A new search or page previews its first match. Browsing is local UI state;
	// only the explicit Add action asks the session to create a saved item.
	const selected = $derived(
		visible.find((entry) => entry.id === selectedId) ?? visible[0],
	);
	$effect(() => {
		// Opening an empty slot leads straight to search; later result updates do
		// not move focus away from the control or item the user is exploring.
		searchInput?.focus();
	});
	$effect(() => {
		// A fresh result page starts with its selected first item visible, rather
		// than inheriting a previous page's scrolled position and hiding that item.
		query;
		kind;
		currentPage;
		if (itemList) itemList.scrollTop = 0;
	});
	function resetResults() {
		page = 0;
		selectedId = undefined;
	}
	async function add() {
		if (!selected || saving) return;
		// Capture the preview before awaiting so search or slot navigation cannot
		// turn this click into a request for a different catalog entry.
		const catalogId = selected.id;
		saving = true;
		try {
			await onadd(catalogId);
		} finally {
			saving = false;
		}
	}
</script>

<section
	aria-label={inventoryKind === "chest"
		? "Add chest item"
		: "Add backpack item"}
	class="picker"
>
	<header>
		<div>
			<h2>Add an item</h2>
			<p>Choose an item for slot {slot + 1}.</p>
		</div>

		{#if oncancel}
			<button type="button" class="back" onclick={oncancel} disabled={saving}>
				Back to backpack
			</button>
		{/if}
	</header>

	<div class="filters">
		<label class="search">
			Search items
			<input
				bind:this={searchInput}
				type="search"
				placeholder="Name or ID, e.g. Wood or (O)388"
				bind:value={
					() => query,
					(value) => {
						query = value;
						resetResults();
					}
				}
			/>
		</label>

		<label>
			Item type
			<select
				bind:value={
					() => kind,
					(value) => {
						kind = value;
						resetResults();
					}
				}
			>
				<option value="all">All items</option>

				{#each kinds as value (value)}
					<option {value}>{kindLabels[value] ?? value}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="catalog-layout">
		<div class="results">
			<p class="result-count" id={`${id}-results`} aria-live="polite">
				{#if results.length}
					{start + 1}–{start + visible.length} of {results.length.toLocaleString()}
					{results.length === 1 ? "item" : "items"}
				{:else}
					No items found
				{/if}
			</p>

			{#if results.length}
				<div
					class="item-list"
					bind:this={itemList}
					aria-describedby={`${id}-results`}
				>
					{#each visible as entry (entry.id)}
						<button
							type="button"
							class="item"
							aria-label={`Preview ${entry.name} (${entry.qualifiedId})`}
							aria-pressed={selected?.id === entry.id}
							onclick={() => {
								selectedId = entry.id;
							}}
						>
							<span class="item-icon">
								<BackpackItemVisual raw={entry.raw} />
							</span>
							<span class="item-identity">
								<span class="item-name">{entry.name}</span>
								<span class="item-id">{entry.qualifiedId}</span>
							</span>
						</button>
					{/each}
				</div>

				{#if pages > 1}
					<nav aria-label="Item result pages" class="pagination">
						<button
							type="button"
							disabled={currentPage === 0}
							onclick={() => {
								page = currentPage - 1;
								selectedId = undefined;
							}}
						>
							Previous
						</button>

						<span>Page {currentPage + 1} of {pages}</span>

						<button
							type="button"
							disabled={currentPage + 1 >= pages}
							onclick={() => {
								page = currentPage + 1;
								selectedId = undefined;
							}}
						>
							Next
						</button>
					</nav>
				{/if}
			{:else}
				<p class="no-results">
					Try another name or ID, or choose a different item type. Specialized
					items such as chests and beds are not available to add yet.
				</p>
			{/if}
		</div>

		{#if selected}
			<section aria-label="Item preview" class="preview">
				<div class="preview-header">
					<div class="preview-icon">
						<BackpackItemVisual raw={selected.raw} />
					</div>
					<div>
						<h3>{selected.name}</h3>
						<p class="preview-id">{selected.qualifiedId}</p>
					</div>
				</div>

				<p class="kind">{kindLabels[selected.kind] ?? selected.kind}</p>

				{#if selected.description}
					<p class="description">{selected.description}</p>
				{/if}

				<p class="addition-note">New items start with quantity 1.</p>

				<button
					type="button"
					class="add"
					onclick={() => void add()}
					disabled={saving}
				>
					{saving ? "Adding…" : `Add to slot ${slot + 1}`}
				</button>

				<p class="feedback" role="status">
					{error || "Use Undo to remove an added item."}
				</p>
			</section>
		{/if}
	</div>
</section>

<style>
	.picker {
		min-width: 0;
	}
	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
	}
	h2 {
		margin: 0 0 8px;
	}
	header p {
		margin: 0;
		color: #694621;
	}
	button,
	input,
	select {
		font: inherit;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		min-height: 44px;
	}
	button {
		cursor: pointer;
		padding: 6px 12px;
	}
	button:hover:not(:disabled) {
		background: #fff8e8;
	}
	button:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.back {
		flex: none;
	}
	.filters {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(160px, 200px);
		gap: 16px;
		margin-bottom: 24px;
	}
	label {
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	input,
	select {
		width: 100%;
		min-width: 0;
		padding: 6px 10px;
		caret-color: #694621;
	}
	.catalog-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
		gap: 24px;
		align-items: start;
	}
	.results {
		min-width: 0;
	}
	.result-count {
		margin: 0 0 12px;
		color: #694621;
		font-size: 18px;
		font-variant-numeric: tabular-nums;
	}
	.item-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-content: start;
		gap: 6px;
		max-height: 420px;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-color: #b98b52 #f7d7a4;
		padding: 3px;
		margin: -3px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		min-height: 64px;
		text-align: left;
		padding: 8px;
	}
	.item[aria-pressed="true"] {
		border-color: #176fb4;
		background: #b5d6e7;
	}
	.item-icon {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		flex: none;
	}
	.item-identity {
		display: grid;
		gap: 5px;
		min-width: 0;
	}
	.item-name {
		overflow-wrap: anywhere;
	}
	.item-id,
	.preview-id {
		font-size: 16px;
		color: #694621;
		overflow-wrap: anywhere;
	}
	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 16px;
		font-size: 18px;
	}
	.pagination span {
		text-align: center;
	}
	.preview {
		border-left: 1px solid #be8d4d;
		padding-left: 24px;
		min-width: 0;
	}
	.preview-header {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.preview-icon {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		flex: none;
	}
	.preview-icon :global(.visual) {
		transform: scale(2);
	}
	h3 {
		margin: 0 0 8px;
		font-size: 26px;
		overflow-wrap: anywhere;
	}
	.preview-id {
		margin: 0;
	}
	.kind {
		margin: 20px 0 12px;
		font-size: 18px;
		color: #694621;
	}
	.description {
		white-space: pre-line;
		line-height: 1.45;
		margin: 0 0 24px;
	}
	.addition-note,
	.feedback,
	.no-results {
		font-size: 18px;
		color: #694621;
		line-height: 1.4;
	}
	.addition-note {
		margin: 24px 0 12px;
	}
	.add {
		width: 100%;
		background: #278440;
		border-color: #17632c;
		color: #fff2d3;
	}
	.add:hover:not(:disabled) {
		background: #1d7134;
	}
	.feedback {
		margin: 12px 0 0;
	}
	@media (max-width: 800px) {
		.catalog-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.preview {
			border-left: 0;
			border-top: 1px solid #be8d4d;
			padding: 24px 0 0;
		}
		.item-list {
			max-height: 320px;
		}
	}
	@media (max-width: 560px) {
		header {
			flex-direction: column;
		}
		.filters,
		.item-list {
			grid-template-columns: minmax(0, 1fr);
		}
		.filters {
			gap: 16px;
		}
		.pagination {
			gap: 6px;
			font-size: 16px;
		}
		.pagination button {
			padding: 6px 8px;
		}
	}
</style>
