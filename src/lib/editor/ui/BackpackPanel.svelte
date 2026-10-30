<script lang="ts">
	import { onDestroy, tick } from "svelte";
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createStorageDomain } from "../storage-domain.ts";
	import { createInventorySelection } from "./inventory-selection.svelte.ts";
	import {
		createInventoryDrag,
		type InventoryDragSource,
	} from "./inventory-drag.svelte.ts";
	import {
		isEquipmentSlot as isEquipment,
		type InventorySlot,
	} from "./inventory-slot.ts";
	import { catalogChoices } from "../item-catalog.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import BackpackItemEditor from "./BackpackItemEditor.svelte";
	import BackpackItemPicker from "./BackpackItemPicker.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selectedFarmer = useAtomValue(
		() => model.atomBindings.selectedFarmerId,
	);
	const backpacks = $derived(view.current?.backpacks ?? []);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.farmerChoices ?? [],
			selectedFarmer.current,
			model,
		),
	);
	const backpack = $derived(
		backpacks.find((owner) => owner.ownerId === selectedFarmer.current),
	);
	const chests = $derived(view.current?.chests ?? []);
	const owners = $derived([...backpacks, ...chests]);
	let operationError = $state("");
	const storage = $derived(createStorageDomain(model));
	let organizing = $state(false);
	async function organize(ownerId: string) {
		if (organizing) return;
		organizing = true;
		operationError = "";
		try {
			const result = await storage.organize(ownerId);
			if (result && Result.isFailure(result))
				operationError = result.failure.message;
		} finally {
			organizing = false;
		}
	}
	let removing = $state(false);
	let moving = $state(false);
	let inventory = $state<HTMLDivElement>();
	const dragToken = $props.id();
	// Effects/events connect these peers after initialization. Cross-controller
	// callbacks stay lazy so neither factory needs its peer during construction.
	const selection = createInventorySelection({
		owners: () => owners,
		backpack: () => backpack,
		chests: () => chests,
		farmerId: () => selectedFarmer.current,
		dragging: () => drag.source !== undefined,
		root: () => inventory,
		revealFarmer: (id) => {
			void model.commands.selectFarmer(id);
		},
		onChoose: () => {
			drag.clearHighlight();
			operationError = "";
		},
	});
	const drag = createInventoryDrag({
		token: dragToken,
		owners: () => owners,
		visibleOwners: () => [backpack, selection.chest],
		root: () => inventory,
		movePending: () => moving,
		selectedEntity: () => selection.entityId,
		ownerOf: selection.ownerOf,
		choose: selection.choose,
		move: (item, source) => {
			void moveItem(item, source);
		},
	});
	onDestroy(drag.dispose);
	const matchingChests = $derived(selection.matchingChests);
	const chest = $derived(selection.chest);
	const selectedOwner = $derived(selection.selectedOwner);
	const selected = $derived(selection.selected);
	const browsing = $derived(selected?.empty && !isEquipment(selected));
	type SlotChange = { kind: "add"; catalogId: string } | { kind: "remove" };
	// Keep clothing and footwear together before accessories in the grid.
	const equipmentOrder = [
		"hat",
		"shirtItem",
		"pantsItem",
		"boots",
		"leftRing",
		"rightRing",
		"trinketItem",
	];
	const equipment = $derived(
		[...(backpack?.equipment ?? [])].sort(
			(a, b) => equipmentOrder.indexOf(a.key) - equipmentOrder.indexOf(b.key),
		),
	);
	function slotLabel(item: InventorySlot) {
		const name = item.empty ? "Empty" : item.name;
		if (isEquipment(item)) return `${item.label}: ${name}`;
		const owner = selection.ownerOf(item);
		const label = owner?.kind === "chest" ? "Chest slot" : "Slot";
		return `${label} ${item.slot + 1}: ${name}`;
	}

	async function moveItem(item: InventorySlot, source: InventoryDragSource) {
		const destination = selection.ownerOf(item);
		if (!destination || moving) return;
		const version = selection.version;
		const destinationOwnerId = destination.ownerId;
		moving = true;
		operationError = "";
		try {
			// Both endpoint handles are rechecked in the queue. Equipment policy checks
			// both exchanged records; the UI never writes optimistic slot replacements.
			const result = await model.commands.moveInventoryItem({
				type: "backpack-move",
				ownerId: source.ownerId,
				entityId: source.entityId,
				toOwnerId: destinationOwnerId,
				toEntityId: item.entityId,
				fromLocation: source.location,
				toLocation: isEquipment(item) ? item.key : "backpack",
			});
			if (!result) return;
			if (Result.isFailure(result)) {
				if (selection.isCurrent(version))
					operationError = result.failure.message;
				return;
			}
			if (selection.followMove(result.success.entityId, version)) {
				drag.clearHighlight();
				moving = false;
				await selection.focus(version);
			}
		} finally {
			moving = false;
			drag.clearHighlight();
		}
	}
	async function changeSlot(change: SlotChange) {
		if (!selectedOwner || !selected || isEquipment(selected)) return false;
		const ownerId = selectedOwner.ownerId;
		const target = selected;
		const version = selection.version;
		const invokingControl = document.activeElement;
		operationError = "";
		const result = await model.commands.changeInventorySlot(
			change.kind === "add"
				? {
						type: "backpack-add",
						ownerId: ownerId,
						entityId: target.entityId,
						catalogId: change.catalogId,
					}
				: {
						type: "backpack-remove",
						ownerId: ownerId,
						entityId: target.entityId,
					},
		);
		if (!result) return false;
		if (Result.isFailure(result)) {
			if (selection.isCurrent(version)) operationError = result.failure.message;
			return false;
		}
		// The exact committed replacement pair keeps selection stable even if a later
		// queued Undo runs before this callback completes. Later user selection wins.
		if (selection.followReplacement(result.success.entityId, version)) {
			await tick();
			if (
				change.kind === "add" &&
				(document.activeElement === invokingControl ||
					document.activeElement === document.body)
			)
				await selection.focus(version);
		}
		return true;
	}
	async function removeSelected() {
		if (removing) return;
		removing = true;
		try {
			await changeSlot({ kind: "remove" });
		} finally {
			removing = false;
		}
	}
</script>

{#snippet slot(item: InventorySlot)}
	<button
		type="button"
		class="slot"
		class:equipment-slot={isEquipment(item)}
		class:active={selected?.entityId === item.entityId}
		class:drop-target={drag.targetId === item.entityId}
		aria-pressed={selected?.entityId === item.entityId}
		aria-label={slotLabel(item)}
		data-inventory-entity={item.entityId}
		title={isEquipment(item) && item.locked
			? `${slotLabel(item)} (locked)`
			: slotLabel(item)}
		disabled={moving}
		draggable={!item.empty && !moving}
		onclick={(event) => drag.click(event, item)}
		onpointerdown={(event) => drag.pointerDown(event, item)}
		onpointermove={drag.pointerMove}
		onpointerup={drag.pointerUp}
		onpointercancel={drag.pointerCancel}
		ondragstart={(event) => drag.startNative(event, item)}
		ondragover={(event) => drag.overNative(event, item)}
		ondragleave={() => drag.leaveNative(item)}
		ondrop={(event) => drag.dropNative(event, item)}
		ondragend={drag.endNative}
	>
		{#if !isEquipment(item)}
			<span class="slot-number" aria-hidden="true">{item.slot + 1}</span>
		{/if}
		{#if !item.empty}
			<BackpackItemVisual visual={item.visual} />
		{:else if isEquipment(item)}
			<span class="empty-equipment" aria-hidden="true"></span>
		{/if}
		{#if !isEquipment(item) && item.quantity !== undefined && item.quantity > 1}
			<span class="quantity" aria-hidden="true">{item.quantity}</span>
		{/if}
	</button>
{/snippet}

<div class="inventory-heading">
	<h1>Inventory</h1>
	<FarmerSelector field={farmerField} />
</div>
{#if (!backpack || !backpack.supported) && chests.length === 0}
	<p role="status">
		{backpack?.reason ?? "No supported backpack is available."} Other save settings
		remain available.
	</p>
{:else}
	<div class="inventory-layout" class:browsing bind:this={inventory}>
		<div class="possessions">
			{#if backpack?.supported}
				<section aria-label={`${backpack.name}'s equipment`} class="equipment">
					<h2>Equipment</h2>
					<div class="equipment-slots">
						{#each equipment as item (item.entityId)}
							<div class="equipment-entry">
								<span class="equipment-label">{item.label}</span>
								{@render slot(item)}
							</div>
						{/each}
					</div>
				</section>
				<section aria-label={`${backpack.name}'s backpack`} class="backpack">
					<div class="backpack-heading">
						<h2>Backpack</h2>
						<span>{backpack.slots.length} slots</span>
						<button
							type="button"
							disabled={organizing || moving}
							onclick={() => void organize(backpack.ownerId)}
						>
							Organize backpack
						</button>
					</div>
					<div class="slots">
						{#each backpack.slots as item (item.entityId)}
							{@render slot(item)}
						{/each}
					</div>
				</section>
			{:else}
				<p role="status">
					{backpack?.reason ?? "No supported backpack is available."} Chest inventories
					remain available below.
				</p>
			{/if}

			<section class="chest" aria-label="Chest inventory">
				<div class="backpack-heading">
					<h2>Chests</h2>
					{#if chest}
						<span>{chest.slots.length} slots</span>
						<button
							type="button"
							disabled={!chest.supported || organizing || moving}
							onclick={() => void organize(chest.ownerId)}
						>
							Organize chest
						</button>
					{/if}
				</div>
				{#if chests.length}
					<div class="chest-controls">
						<label>
							Find a chest
							<input
								type="search"
								placeholder="Name or location"
								bind:value={
									() => selection.query, (value) => selection.search(value)
								}
							/>
						</label>
						{#if matchingChests.length}
							<label>
								Chest
								<select
									bind:value={
										() => chest?.ownerId,
										(value) => selection.selectChest(value)
									}
								>
									{#each matchingChests as owner (owner.ownerId)}
										<option value={owner.ownerId}>{owner.name}</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>
					{#if chest}
						<p class="chest-location">{chest.location}</p>
						{#if chest.supported}
							<div class="slots" aria-label={chest.name}>
								{#each chest.slots as item (item.entityId)}
									{@render slot(item)}
								{/each}
							</div>
						{:else}
							<p role="status">{chest.reason}</p>
						{/if}
					{:else}
						<p role="status">No chests match. Try another name or location.</p>
					{/if}
				{:else}
					<p class="chest-location">
						No placed chests were found in this save.
					</p>
				{/if}
			</section>
		</div>
		<div class="inspector" class:browsing>
			{#if selectedOwner && selected && !selected.empty}
				{#key JSON.stringify([selectedOwner?.ownerId, selected.entityId])}
					<BackpackItemEditor
						{model}
						ownerId={selectedOwner.ownerId}
						inventoryKind={selectedOwner.kind === "chest"
							? "chest"
							: "backpack"}
						item={selected}
						locationLabel={isEquipment(selected)
							? selected.label
							: selectedOwner?.kind === "chest"
								? `${selectedOwner.name} · Slot ${selected.slot + 1}`
								: undefined}
						onremove={isEquipment(selected) ? undefined : removeSelected}
						{removing}
					/>
				{/key}
			{:else if selected && isEquipment(selected)}
				<section class="empty-detail" aria-label="Empty equipment slot">
					<h2>{selected.label}</h2>
					<p>
						{selected.locked
							? "This slot is locked in this save."
							: "Drag a compatible item here from the backpack."}
					</p>
				</section>
			{:else if selected?.empty}
				<BackpackItemPicker
					slot={selected.slot}
					inventoryKind={selectedOwner?.kind === "chest" ? "chest" : "backpack"}
					entries={catalogChoices}
					error={operationError}
					onadd={(id) => changeSlot({ kind: "add", catalogId: id })}
				/>
			{:else}
				<p role="status">
					The selected item is no longer available. Select another slot.
				</p>
			{/if}
			{#if operationError && !browsing}
				<p role="status" class="operation-error">{operationError}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.inventory-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	h1 {
		margin: 0;
	}
	h2 {
		font-size: 24px;
		margin: 0 0 12px;
	}
	select,
	input[type="search"] {
		font: inherit;
		min-height: 40px;
		max-width: 220px;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		padding: 4px 8px;
	}
	.chest {
		margin-top: 28px;
		padding-top: 24px;
		border-top: 1px solid #be8d4d;
	}
	.chest-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
		gap: 12px;
	}
	.chest-controls label {
		display: grid;
		gap: 6px;
		min-width: 0;
		font-size: 17px;
	}
	.chest-controls select,
	.chest-controls input {
		width: 100%;
		max-width: none;
		min-width: 0;
	}
	.chest-location {
		color: #694621;
		font-size: 17px;
		margin: 12px 0;
	}
	.chest-controls :is(input, select):focus-visible {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	.inventory-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
		gap: 28px;
		align-items: start;
	}
	.inventory-layout.browsing {
		grid-template-columns: minmax(0, 1fr);
	}
	.possessions {
		min-width: 0;
	}
	.equipment {
		margin-bottom: 24px;
	}
	.equipment-slots {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 8px;
	}
	.equipment-entry {
		display: grid;
		justify-items: center;
		gap: 6px;
		min-width: 0;
	}
	.equipment-label {
		font-size: 17px;
		color: #694621;
		white-space: nowrap;
	}
	.backpack-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.backpack-heading span {
		font-size: 17px;
		color: #694621;
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 4px;
	}
	.slot {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		min-height: 44px;
		min-width: 0;
		width: 100%;
		padding: 2px;
		border: 2px solid #b98b52;
		background: #f7d7a4;
		cursor: pointer;
	}
	.equipment-slot {
		width: 48px;
		height: 48px;
	}
	.empty-equipment {
		width: 18px;
		height: 18px;
		border: 1px dashed #b98b52;
	}
	.slot:hover {
		background: #fff0d3;
	}
	.slot.active {
		background: #b5d6e7;
		border-color: #176fb4;
	}
	.slot.drop-target {
		background: #cce5ef;
		outline: 2px solid #176fb4;
		outline-offset: 1px;
	}
	.slot:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 3px;
	}
	.slot[draggable="true"] {
		cursor: grab;
		/* Keep touch drags on occupied slots local; the rest of the page and empty
		   slots retain native scrolling. Mouse dragging still uses HTML drag/drop. */
		touch-action: none;
		user-select: none;
	}
	.slot:disabled {
		cursor: wait;
	}
	.slot-number {
		position: absolute;
		top: 1px;
		left: 3px;
		font-size: 13px;
		color: #694621;
	}
	.quantity {
		position: absolute;
		bottom: 0;
		right: 2px;
		font-size: 17px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		/* Outline the count itself so it stays legible over sprites without
		   covering the item with a rectangular label background. */
		color: #fff2d3;
		text-shadow:
			-1px -1px #311304,
			1px -1px #311304,
			-1px 1px #311304,
			1px 1px #311304;
	}
	.inspector {
		border-left: 1px solid #be8d4d;
		padding-left: 24px;
		min-width: 0;
	}
	.inspector.browsing {
		border-left: 0;
		border-top: 1px solid #be8d4d;
		padding: 20px 0 0;
	}
	.operation-error {
		color: #8c2f1b;
	}
	.empty-detail p {
		color: #694621;
	}
	@media (max-width: 1300px) {
		.inventory-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.inspector {
			border-left: 0;
			border-top: 1px solid #be8d4d;
			padding: 20px 0 0;
		}
	}
	@media (max-width: 600px) {
		.chest-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.inventory-heading {
			margin-bottom: 16px;
			align-items: center;
		}
		h1 {
			font-size: 28px;
		}
		h2 {
			font-size: 22px;
			margin-bottom: 10px;
		}
		select {
			max-width: 140px;
			min-height: 36px;
		}
		.equipment {
			margin-bottom: 20px;
		}
		.equipment-slots {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 10px 8px;
		}
		.equipment-label {
			font-size: 16px;
		}
		.equipment-slot {
			width: 44px;
			height: 44px;
		}
		.slots {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
		.inventory-layout {
			gap: 20px;
		}
	}
</style>
