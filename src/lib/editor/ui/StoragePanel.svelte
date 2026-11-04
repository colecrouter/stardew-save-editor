<script lang="ts">
	import { onDestroy } from "svelte";
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import type { InventoryView, InventorySlotView } from "../inventory-views.ts";
	import { createStorageDomain, searchStorage } from "../storage-domain.ts";
	import { storageTypes } from "../storage-policy.ts";
	import { inventoryQualities } from "../inventory-policy.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import BackpackItemEditor from "./BackpackItemEditor.svelte";
	import {
		createInventoryDrag,
		type InventoryDragSource,
	} from "./inventory-drag.svelte.ts";
	import type { InventorySlot } from "./inventory-slot.ts";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
	import StudyCheckbox from "../../ui/kit/StudyCheckbox.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import QualityBadge from "./QualityBadge.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";

	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const domain = $derived(createStorageDomain(model));
	const owners = $derived(view.current?.chests ?? []);
	let search = $state("");
	let location = $state("");
	let selectedId = $state<string>();
	let picked = $state<string[]>([]);
	let selectMany = $state(false);
	let busy = $state(false);
	let error = $state("");
	let root = $state<HTMLDivElement>();
	const token = $props.id();
	const inspectorId = `${token}-details`;
	const containersId = `${token}-containers`;
	const matches = $derived(searchStorage(owners, search));
	const matchIds = $derived(new Set(matches.map((row) => row.item.entityId)));
	const locations = $derived([
		...new Set(owners.map((owner) => owner.location ?? "Unknown location")),
	]);
	const shown = $derived(
		owners.filter((owner) =>
			!search.trim()
				? !location || owner.location === location
				: matches.some((row) => row.owner.ownerId === owner.ownerId),
		),
	);
	const visibleItems = $derived(
		shown.flatMap((owner) =>
			owner.slots
				.filter(
					(item) =>
						!item.empty && (!search.trim() || matchIds.has(item.entityId)),
				)
				.map((item) => ({ owner, item })),
		),
	);
	const selected = $derived(
		owners
			.flatMap((owner) => owner.slots.map((item) => ({ owner, item })))
			.find((row) => row.item.entityId === selectedId),
	);
	const pickedItems = $derived(
		visibleItems.filter((row) => picked.includes(row.item.entityId)),
	);
	const qualityItems = $derived(
		(pickedItems.length ? pickedItems : visibleItems).filter(
			(row) => row.item.canQuality,
		),
	);
	const ownerOf = (item: InventorySlot): InventoryView | undefined =>
		owners.find((owner) =>
			owner.slots.some((entry) => entry.entityId === item.entityId),
		);
	function choose(entityId: string) {
		selectedId = entityId;
		// Beginning a drag on one of the picked instances retains the batch; choosing
		// an unrelated item starts a fresh selection without retargeting pending work.
		if (!picked.includes(entityId)) picked = [];
	}
	const drag = createInventoryDrag({
		token,
		owners: () => owners,
		visibleOwners: () => shown,
		root: () => root,
		movePending: () => busy,
		selectedEntity: () => selectedId,
		ownerOf,
		choose,
		move: (item, source) => void move(item, source),
	});
	onDestroy(drag.dispose);
	$effect(() => {
		const eligible = new Set(visibleItems.map((row) => row.item.entityId));
		if (picked.some((id) => !eligible.has(id)))
			picked = picked.filter((id) => eligible.has(id));
		if (selectedId && !eligible.has(selectedId)) selectedId = undefined;
	});
	async function perform(
		action: () => Promise<
			import("../command-result.ts").CommandResult<unknown, { message: string }>
		>,
	) {
		if (busy) return;
		busy = true;
		error = "";
		try {
			const result = await action();
			if (result && Result.isFailure(result)) error = result.failure.message;
		} finally {
			busy = false;
			drag.clearHighlight();
		}
	}
	function select(event: MouseEvent, item: InventorySlotView) {
		const previous = picked,
			previousSelected = selectedId;
		// The shared controller rejects the compatibility click following a touch
		// drag before any multiselect state can toggle.
		if (!drag.click(event, item)) return;
		if (!item.empty && (selectMany || event.ctrlKey || event.metaKey)) {
			picked = previous.includes(item.entityId)
				? previous.filter((id) => id !== item.entityId)
				: [
						...new Set([
							...previous,
							...(previous.length || !previousSelected
								? []
								: [previousSelected]),
							item.entityId,
						]),
					];
			// The last toggled-off item no longer owns single-item feedback. Keep
			// the surviving picked handle as the eventual inspector target.
			selectedId = picked.at(-1);
		} else picked = [];
	}

	async function move(item: InventorySlot, source: InventoryDragSource) {
		const owner = ownerOf(item);
		if (!owner) return;
		const batch =
			pickedItems.some((row) => row.item.entityId === source.entityId) &&
			pickedItems.length > 1
				? pickedItems.map((row) => ({
						ownerId: row.owner.ownerId,
						entityId: row.item.entityId,
					}))
				: undefined;
		if (batch) {
			await perform(() => domain.transfer(batch, owner.ownerId));
		} else {
			await perform(() =>
				model.commands.moveInventoryItem({
					type: "backpack-move",
					ownerId: source.ownerId,
					entityId: source.entityId,
					toOwnerId: owner.ownerId,
					toEntityId: item.entityId,
					fromLocation: source.location,
					toLocation: "backpack",
				}),
			);
		}
	}
	async function changeType(ownerId: string, control: HTMLSelectElement) {
		const requested = control.value;
		await perform(() => domain.changeType(ownerId, requested));
		// A refused conversion publishes no revision, so the select must explicitly
		// return to the current domain value rather than keeping its attempted option.
		const current = owners.find((owner) => owner.ownerId === ownerId)?.storage
			?.typeId;
		if (control.isConnected && current) control.value = current;
	}

	const label = (item: InventorySlotView) =>
		`Slot ${item.slot + 1}: ${item.empty ? "Empty" : item.name}`;
</script>

<div class="storage">
	<header class="heading">
		<div>
			<h1>Storage</h1>
			<p>Find your supplies, wherever you put them.</p>
		</div>
		<div class="heading-actions">
			<a class="detail-link" href={`#${inspectorId}`}>Selected item</a>
			<StudyButton
				type="button"
				disabled={busy || !owners.some((owner) => owner.supported)}
				onclick={() =>
					void perform(() =>
						domain.organizeAll(
							owners
								.filter((owner) => owner.supported)
								.map((owner) => owner.ownerId),
						),
					)}
			>
				Organize all storage
			</StudyButton>
		</div>
	</header>
	<div class="toolbar">
		<StudyField label="Search stored items">
			{#snippet children(attributes)}
				<input
					{...attributes}
					class="study-input"
					type="search"
					bind:value={search}
					placeholder="Item name or ID"
					onkeydown={(event) => {
						if (event.key === "Escape") search = "";
					}}
				/>
			{/snippet}
		</StudyField>
		<StudyField
			label="Location"
			description="Item search covers all locations."
		>
			{#snippet children(attributes)}
				<select
					{...attributes}
					class="study-input"
					bind:value={location}
					disabled={!!search.trim()}
				>
					<option value="">All locations</option>
					{#each locations as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			{/snippet}
		</StudyField>
		<div class="multi">
			<StudyCheckbox label="Select multiple items" bind:checked={selectMany} />
		</div>
	</div>
	<div class="bulk" aria-label="Bulk storage actions">
		<span>
			{pickedItems.length
				? `${pickedItems.length} selected`
				: `${visibleItems.length} visible items`}
		</span>
		<StudyButton
			disabled={!picked.length}
			type="button"
			onclick={() => {
				picked = [];
			}}
		>
			Clear selection
		</StudyButton>
		<fieldset class="quality-actions">
			<legend>
				Quality of {pickedItems.length ? "selected" : "visible"} eligible items
			</legend>
			<div class="quality-buttons">
				{#each inventoryQualities as quality (quality.value)}
					<StudyButton
						type="button"
						aria-label={quality.label}
						title={quality.label}
						disabled={busy || !qualityItems.length}
						onclick={() => {
							const captured = qualityItems.map((row) => ({
								ownerId: row.owner.ownerId,
								entityId: row.item.entityId,
							}));
							void perform(() => domain.quality(captured, quality.value));
						}}
					>
						<span class="quality-symbol" aria-hidden="true">
							<QualityBadge quality={quality.value} />
							{#if quality.value === 0}—{/if}
						</span>
						<span class="quality-name">{quality.label}</span>
					</StudyButton>
				{/each}
			</div>
		</fieldset>
	</div>
	{#if error}
		<StudyAlert
			title="Storage change unavailable"
			tone="danger"
			live="assertive"
		>
			<p>{error}</p>
		</StudyAlert>
	{/if}
	<!-- Stable guidance keeps the chest grids in place as selection grows. -->
	<p class="hint">
		Drag between containers; selected groups move together. Organize keeps
		stacks separate.
	</p>
	<div class="workspace">
		<!-- The drag root is the scrollable chest pane, so held touch drags can
             scroll it before falling back to a parent or the document. -->
		<div class="containers" id={containersId} bind:this={root}>
			{#each shown as owner (owner.ownerId)}
				<section class="container" aria-label={owner.name}>
					<header>
						<div class="container-identity">
							<StudyIcon name="chests" size={32} />
							<div>
								<h2>{owner.name}</h2>
								<small>
									{owner.location} · {owner.slots.filter((item) => !item.empty)
										.length}/{owner.capacity ?? owner.slots.length} occupied
								</small>
							</div>
						</div>
						<StudyButton
							type="button"
							disabled={busy || !owner.supported}
							onclick={() => void perform(() => domain.organize(owner.ownerId))}
						>
							Organize
						</StudyButton>
					</header>
					{#if owner.storage?.typeId}
						<label class="type">
							Container type
							<select
								value={owner.storage.typeId}
								disabled={busy || !owner.supported}
								onchange={(event) =>
									void changeType(owner.ownerId, event.currentTarget)}
							>
								{#each storageTypes as type (type.itemId)}
									<option
										value={type.itemId}
										disabled={owner.slots.filter((item) => !item.empty).length >
											type.capacity}
									>
										{type.name} · {type.capacity} slots
									</option>
								{/each}
							</select>
						</label>
					{/if}
					{#if owner.storage?.miniShippingBin}
						<StudyButton
							type="button"
							disabled={busy ||
								!owner.supported ||
								!!owner.storage.expansionReason}
							title={owner.storage.expansionReason}
							onclick={() =>
								void perform(() => domain.changeType(owner.ownerId, "130"))}
						>
							Expand shipping bin to Chest
						</StudyButton>
						<p class="hint">
							Keeps its items, but they will no longer ship overnight.
						</p>
					{/if}
					{#if !owner.supported}
						<StudyAlert title="Container unavailable" tone="warning">
							<p>{owner.reason}</p>
						</StudyAlert>
					{:else}
						<div class="slots">
							{#each owner.slots as item (item.entityId)}
								<button
									type="button"
									class="slot"
									class:picked={picked.includes(item.entityId)}
									class:selected={selectedId === item.entityId}
									class:dimmed={!!search.trim() &&
										!item.empty &&
										!matchIds.has(item.entityId)}
									class:drop={drag.targetId === item.entityId}
									aria-label={label(item)}
									aria-pressed={picked.length
										? picked.includes(item.entityId)
										: selectedId === item.entityId}
									disabled={busy}
									data-inventory-entity={item.entityId}
									draggable={!item.empty && !busy}
									onclick={(event) => select(event, item)}
									ondragstart={(event) => drag.startNative(event, item)}
									ondragover={(event) => drag.overNative(event, item)}
									ondrop={(event) => drag.dropNative(event, item)}
									ondragleave={() => drag.leaveNative(item)}
									ondragend={drag.endNative}
									onpointerdown={(event) => drag.pointerDown(event, item)}
									onpointermove={drag.pointerMove}
									onpointerup={drag.pointerUp}
									onpointercancel={drag.pointerCancel}
								>
									{#if !item.empty}
										<BackpackItemVisual visual={item.visual} />
									{/if}
									{#if item.quantity !== undefined && item.quantity > 1}
										<span class="quantity" aria-hidden="true">
											{item.quantity}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</section>
			{:else}
				<p>
					{search.trim()
						? "No stored items match this search."
						: "No storage containers were found here."}
				</p>
			{/each}
		</div>
		<!-- Reserve the desktop inspector column before a drag begins. Selecting
             its source must not reflow the grids underneath the active pointer. -->
		<aside aria-label="Stored item details" id={inspectorId}>
			<div class="inspector-heading">
				<span>Selected item</span>
				<a class="detail-link" href={`#${containersId}`}>Back to containers</a>
			</div>
			{#if selected && !selected.item.empty && !selectMany && pickedItems.length === 0}
				{#key selected.item.entityId}
					<BackpackItemEditor
						{model}
						ownerId={selected.owner.ownerId}
						item={selected.item}
						locationLabel={`${selected.owner.name} · Slot ${selected.item.slot + 1}`}
						inventoryKind="chest"
					/>
				{/key}
			{:else}
				<p class="inspector-hint">
					Select an item in any container to inspect its quantity, quality and
					properties. Select multiple items to apply a quality or move them
					together.
				</p>
			{/if}
		</aside>
	</div>
</div>

<style>
	/* The feature gets one desktop viewport budget. Flex gives the panes the
    remaining space after wrapped toolbars, rather than guessing their offset. */
	.storage {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - 240px);
		min-height: 680px;
	}
	.storage > * {
		flex-shrink: 0;
	}

	h1 {
		font-size: 34px;
		margin: 0 0 8px;
	}
	.heading,
	.container header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 12px;
	}
	.heading {
		margin-bottom: 18px;
		flex-wrap: wrap;
	}
	.heading p {
		margin: 0;
		color: #694621;
	}
	.heading-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.detail-link {
		display: none;
		color: #754522;
		padding-block: 8px;
	}
	.toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		gap: 14px;
		align-items: start;
	}
	.multi {
		padding-top: 34px;
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 10px;
		padding: 12px 0;
		font-size: 17px;
		border-bottom: 1px solid #b98b52;
	}
	.bulk > span {
		align-self: center;
		min-width: 115px;
		color: #694621;
	}
	.quality-actions {
		border: 0;
		margin: 0 0 0 auto;
		padding: 0;
		min-width: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 6px;
		font-size: 16px;
		color: #694621;
	}
	.quality-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.quality-symbol {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 14px;
	}
	.quality-buttons :global(button) {
		font-size: 17px;
	}
	.hint {
		color: #694621;
		font-size: 16px;
		line-height: 1.3;
		min-height: 42px;
		margin: 8px 0;
	}
	/* Both panes own fixed desktop scroll areas. Selecting a different item changes
    the inspector's contents, never the chest grid's width or position. */
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 16px;
		align-items: start;
		flex: 1 0 360px;
		min-height: 0;
	}
	.containers {
		display: grid;
		gap: 12px;
		min-width: 0;
		height: 100%;
		overflow: auto;
		align-content: start;
		scrollbar-gutter: stable;
		padding: 2px 8px 4px 2px;
	}
	.container {
		border: 2px solid #b98b52;
		background: #fff1d2;
		padding: 12px;
		min-width: 0;
	}
	.container header {
		align-items: center;
		margin-bottom: 10px;
	}
	.container-identity {
		display: flex;
		gap: 10px;
		align-items: center;
		min-width: 0;
	}
	.container-identity > div {
		min-width: 0;
	}
	h2 {
		font-size: 21px;
		margin: 0 0 4px;
		overflow-wrap: anywhere;
	}
	small {
		font-size: 16px;
		color: #79522d;
	}
	.type {
		display: grid;
		grid-template-columns: auto minmax(0, 240px);
		align-items: center;
		gap: 10px;
		font-size: 16px;
		color: #694621;
		margin-bottom: 10px;
	}
	select {
		min-width: 0;
		max-width: 100%;
		font: inherit;
		padding: 5px 8px;
		min-height: 40px;
		color: #311304;
		border: 2px solid #b98b52;
		background: #fff2d3;
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(auto-fill, 44px);
		gap: 4px;
		margin-top: 10px;
	}
	.slot {
		position: relative;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 2px;
		border: 2px solid #b98b52;
		background: #f7d7a4;
		box-shadow:
			inset 1px 1px #fff0cc,
			inset -1px -1px #d1a56c;
		cursor: pointer;
	}
	.slot:hover {
		background: #fff0d3;
	}
	.slot.selected {
		background: #fff3c5;
		border-color: #8a451f;
		box-shadow: inset 0 0 0 2px #e6a23e;
	}
	.slot.picked {
		background: #d9e4b1;
		outline: 2px solid #537130;
		outline-offset: -2px;
	}
	.slot.dimmed {
		opacity: 0.35;
	}
	.slot.drop {
		outline: 3px solid #176fb4;
		background: #cce5ef;
	}
	.slot:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	.slot[draggable="true"] {
		touch-action: none;
		user-select: none;
		cursor: grab;
	}
	.slot:disabled {
		opacity: 0.65;
		cursor: wait;
	}
	.quantity {
		position: absolute;
		bottom: 0;
		right: 2px;
		font-size: 17px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: #fff2d3;
		text-shadow:
			-1px -1px #311304,
			1px -1px #311304,
			-1px 1px #311304,
			1px 1px #311304;
		pointer-events: none;
	}
	aside {
		min-width: 0;
		height: 100%;
		overflow: auto;
		scrollbar-gutter: stable;
		border: 2px solid #b98b52;
		background: #fff0d0;
		padding: 12px;
		container-type: inline-size;
	}
	.inspector-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		font-size: 17px;
		color: #694621;
		border-bottom: 1px solid #be8d4d;
		padding-bottom: 10px;
		margin-bottom: 14px;
	}
	.inspector-hint {
		color: #79522d;
		margin: 0;
		line-height: 1.4;
	}
	@media (min-width: 1700px) {
		.containers {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
		}
	}
	@media (max-width: 1150px) {
		.storage {
			height: auto;
			min-height: 0;
		}
		/* Narrow screens use document scrolling and deliberate anchor navigation to
     details; selecting or dragging never forces a jump away from the chest. */
		.workspace {
			grid-template-columns: minmax(0, 1fr);
			height: auto;
			flex: none;
		}
		.containers {
			height: auto;
			overflow: visible;
			padding-right: 2px;
		}
		aside {
			height: auto;
			min-height: 260px;
			overflow: visible;
		}
		.detail-link {
			display: inline-block;
		}
		.toolbar {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.multi {
			grid-column: 1 / -1;
			padding-top: 0;
		}
		.quality-actions {
			margin-left: 0;
		}
	}
	@media (max-width: 600px) {
		/* Four familiar quality symbols fit one phone row. Complete action names
     remain available to assistive technology and pointer tooltips. */
		.quality-name {
			display: none;
		}
		.quality-buttons :global(button) {
			width: 44px;
			padding: 6px;
		}
		.quality-symbol :global(svg) {
			width: 18px;
			height: 18px;
		}

		h1 {
			font-size: 28px;
		}
		.toolbar {
			grid-template-columns: minmax(0, 1fr);
			gap: 10px;
		}
		.container {
			padding: 8px;
		}
		.container header {
			flex-wrap: wrap;
		}
		.type {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
		.slots {
			gap: 3px;
		}
	}
</style>
