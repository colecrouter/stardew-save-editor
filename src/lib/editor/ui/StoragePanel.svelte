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

	let { model }: { model: EditorModel } = $props();
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

<div class="storage" bind:this={root}>
	<header class="heading">
		<div>
			<h1>Storage</h1>
			<p>
				Find items across your containers. Organize keeps stacks separate; Undo
				restores each whole operation.
			</p>
		</div>
		<button
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
		</button>
	</header>
	<div class="toolbar">
		<label>
			Search stored items
			<input
				type="search"
				bind:value={search}
				placeholder="Item name or ID"
				onkeydown={(event) => {
					if (event.key === "Escape") search = "";
				}}
			/>
		</label>
		<label>
			Location
			<select bind:value={location} disabled={!!search.trim()}>
				<option value="">All locations</option>
				{#each locations as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
		</label>
		<label class="multi">
			<input type="checkbox" bind:checked={selectMany} />
			Select multiple items
		</label>
	</div>
	<div class="bulk" aria-label="Bulk storage actions">
		<span>
			{pickedItems.length
				? `${pickedItems.length} selected`
				: `${visibleItems.length} visible items`}
		</span>
		{#if picked.length}
			<button
				type="button"
				onclick={() => {
					picked = [];
				}}
			>
				Clear selection
			</button>
		{/if}
		<span>
			Quality of {pickedItems.length ? "selected" : "visible"} eligible items:
		</span>
		{#each inventoryQualities as quality (quality.value)}
			<button
				type="button"
				disabled={busy || !qualityItems.length}
				onclick={() => {
					const captured = qualityItems.map((row) => ({
						ownerId: row.owner.ownerId,
						entityId: row.item.entityId,
					}));
					void perform(() => domain.quality(captured, quality.value));
				}}
			>
				{quality.label}
			</button>
		{/each}
	</div>
	{#if error}
		<p role="alert">{error}</p>
	{/if}
	{#if pickedItems.length > 1}
		<p class="hint">
			Drag a selected item onto another container to move the entire selection
			into its free slots. Ctrl/Cmd+click also changes the selection.
		</p>
	{/if}
	<div class="workspace">
		<div class="containers">
			{#each shown as owner (owner.ownerId)}
				<section class="container" aria-label={owner.name}>
					<header>
						<div>
							<h2>{owner.name}</h2>
							<small>
								{owner.location} · {owner.slots.filter((item) => !item.empty)
									.length}/{owner.capacity ?? owner.slots.length} occupied
							</small>
						</div>
						<button
							type="button"
							disabled={busy || !owner.supported}
							onclick={() => void perform(() => domain.organize(owner.ownerId))}
						>
							Organize
						</button>
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
						<button
							type="button"
							disabled={busy ||
								!owner.supported ||
								!!owner.storage.expansionReason}
							title={owner.storage.expansionReason}
							onclick={() =>
								void perform(() => domain.changeType(owner.ownerId, "130"))}
						>
							Expand shipping bin to Chest
						</button>
						<p class="hint">
							Keeps its items, but they will no longer ship overnight.
						</p>
					{/if}
					{#if !owner.supported}
						<p role="status">{owner.reason}</p>
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
		<aside aria-label="Stored item details">
			{#if selected && !selected.item.empty && !selectMany && pickedItems.length === 0}
				{#key selected.item.entityId}
					<BackpackItemEditor
						{model}
						ownerId={selected.owner.ownerId}
						item={selected.item}
						locationLabel={selected.owner.name}
						inventoryKind="chest"
					/>
				{/key}
			{:else}
				<p class="inspector-hint">
					Select a single item to edit its properties. Multi-select actions are
					available above.
				</p>
			{/if}
		</aside>
	</div>
</div>

<style>
	h1 {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 34px;
		margin: 0 0 8px;
	}
	.heading,
	.container header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 16px;
	}
	.heading p {
		margin: 0 0 20px;
		max-width: 70ch;
		color: #6b5239;
	}
	button,
	input,
	select {
		font: inherit;
		color: inherit;
		border: 1px solid #ad7d45;
		border-radius: 6px;
		background: #fff8e8;
		padding: 8px 10px;
		box-sizing: border-box;
	}
	button {
		cursor: pointer;
		background: #efd29a;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	input,
	select {
		min-width: 0;
		max-width: 100%;
	}
	label {
		display: grid;
		gap: 6px;
		font-size: 14px;
	}
	.toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		gap: 16px;
		margin-bottom: 16px;
		align-items: end;
	}
	.multi {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 20px;
		font-size: 14px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(250px, 330px);
		gap: 24px;
		align-items: start;
	}
	.inspector-hint {
		color: #725333;
		border: 1px dashed #b68a52;
		border-radius: 8px;
		padding: 16px;
		margin: 0;
	}
	.containers {
		display: grid;
		gap: 20px;
		min-width: 0;
	}
	.container {
		border: 1px solid #ad7d45;
		border-radius: 10px;
		background: #fff3d9;
		padding: 16px;
		min-width: 0;
	}
	h2 {
		font-size: 19px;
		margin: 0 0 6px;
		overflow-wrap: anywhere;
	}
	small {
		color: #6b5239;
	}
	.type {
		margin: 14px 0;
		max-width: 320px;
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(auto-fill, 44px);
		gap: 5px;
		margin-top: 14px;
	}
	.slot {
		position: relative;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 3px;
		border-radius: 4px;
		border: 1px solid #a97d45;
		background: #ead4ac;
		touch-action: none;
	}
	.slot.selected {
		outline: 2px solid #5b3820;
		outline-offset: 1px;
	}
	.slot.picked {
		background: #d9e4b1;
		outline: 2px solid #537130;
	}
	.slot.dimmed {
		opacity: 0.35;
	}
	.slot.drop {
		outline: 3px solid #517947;
	}
	.quantity {
		position: absolute;
		bottom: 0;
		right: 2px;
		font-size: 12px;
		color: white;
		text-shadow:
			1px 1px #34210d,
			-1px -1px #34210d,
			1px -1px #34210d,
			-1px 1px #34210d;
		pointer-events: none;
	}
	aside {
		position: sticky;
		top: 12px;
		min-width: 0;
	}
	.hint {
		color: #6b5239;
		font-size: 13px;
	}
	[role="alert"] {
		color: #9a2c17;
	}
	@media (max-width: 900px) {
		.workspace {
			grid-template-columns: minmax(0, 1fr);
		}
		aside {
			position: static;
		}
	}
	@media (max-width: 600px) {
		.heading {
			flex-direction: column;
		}
		.toolbar {
			grid-template-columns: minmax(0, 1fr);
		}
		.container {
			padding: 12px;
		}
		h1 {
			font-size: 29px;
		}
	}
</style>
