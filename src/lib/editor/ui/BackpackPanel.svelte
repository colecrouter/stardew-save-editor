<script lang="ts">
	import { tick } from "svelte";
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import {
		CategoriesWithQuality,
		ItemDescription,
		ItemNameHelper,
		ResolveItemData,
	} from "$lib/ItemData";
	import type { Item } from "$types/save";
	import type { EditorModel } from "../editor-model.ts";
	import {
		canEquipItem,
		type EquipmentSlot,
		type EquipmentSlotView,
	} from "../equipment.ts";
	import {
		getBackpackItemCapabilities,
		type BackpackSlotView,
		type BackpackView,
	} from "../inventory-operations.ts";
	import { catalogEntries } from "../item-catalog.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import BackpackItemEditor from "./BackpackItemEditor.svelte";
	import BackpackItemPicker from "./BackpackItemPicker.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	let farmerIndex = $state(0);
	const backpacks = $derived(view.current?.backpacks ?? []);
	const backpack = $derived(backpacks[farmerIndex]);
	type InventorySlot = BackpackSlotView | EquipmentSlotView;
	let selectedEntity = $state<string>();
	let selectionFamily = $state<string[]>([]);
	let selectionVersion = 0;
	let operationError = $state("");
	let removing = $state(false);
	let moving = $state(false);
	let inventory = $state<HTMLDivElement>();
	type DragSource = {
		farmerId: string;
		entityId: string;
		location: "backpack" | EquipmentSlot;
	};
	let dragSource = $state<DragSource>();
	let pointerGesture:
		| {
				id: number;
				x: number;
				y: number;
				source: DragSource;
				dragging: boolean;
		  }
		| undefined;
	let ignorePointerClick = false;
	let dropEntity = $state<string>();
	const dragToken = $props.id();
	const dragType = "application/x-stardew-backpack-item";
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
	function allSlots(owner: BackpackView) {
		return [...owner.slots, ...owner.equipment];
	}
	function isEquipment(item: InventorySlot): item is EquipmentSlotView {
		return "key" in item;
	}
	// Explicit selection starts a new lineage. Only our own add/remove replacements
	// extend it, so Undo can restore that instance without selecting an unrelated item.
	function choose(entityId: string | undefined) {
		selectionVersion++;
		dragSource = undefined;
		dropEntity = undefined;
		selectedEntity = entityId;
		selectionFamily = entityId ? [entityId] : [];
		operationError = "";
	}
	const selected = $derived(
		!backpack
			? undefined
			: selectedEntity === undefined
				? (allSlots(backpack).find((item) => !item.empty) ?? backpack.slots[0])
				: (allSlots(backpack).find(
						(item) => item.entityId === selectedEntity,
					) ??
					allSlots(backpack).find((item) =>
						selectionFamily.includes(item.entityId),
					)),
	);
	const browsing = $derived(selected?.empty && !isEquipment(selected));
	$effect(() => {
		// Pin the initial instance too; later reorders must not retarget an implicit
		// first-slot selection. Equipment and backpack records share this identity path.
		if (selectedEntity === undefined && selected) {
			selectedEntity = selected.entityId;
			selectionFamily = [selected.entityId];
		}
	});
	$effect(() => {
		// Handles travel between equipment, backpacks and owners. Undo/Redo follows
		// the selected instance, while explicit farmer selection starts a new lineage.
		if (!dragSource && selectedEntity) {
			const owner = backpacks.findIndex(
				(owner) =>
					owner.supported &&
					allSlots(owner).some(
						(item) =>
							item.entityId === selectedEntity ||
							selectionFamily.includes(item.entityId),
					),
			);
			if (owner >= 0 && owner !== farmerIndex) farmerIndex = owner;
		}
	});
	async function focusSelected(version = selectionVersion) {
		await tick();
		if (version !== selectionVersion || inventory?.closest("[hidden]")) return;
		inventory
			?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
			?.focus();
	}
	function display(item: InventorySlot) {
		let info: ReturnType<typeof ResolveItemData>;
		let name = item.name;
		try {
			if (item.raw) {
				info = ResolveItemData(item.raw as unknown as Item);
				name = ItemNameHelper(item.raw as unknown as Item) ?? name;
			}
		} catch {
			// Imported records remain visible and draggable even when their metadata
			// cannot resolve. Displaying one never constructs a repairing legacy proxy.
		}
		const capabilities = isEquipment(item)
			? { canStack: false, canQuality: false }
			: getBackpackItemCapabilities(
					item.raw,
					info?._type === "Object",
					CategoriesWithQuality.has(item.raw?.category as never),
				);
		return { name, description: ItemDescription(info), ...capabilities };
	}
	function slotLabel(item: InventorySlot) {
		return `${isEquipment(item) ? item.label : `Slot ${item.slot + 1}`}: ${item.empty ? "Empty" : display(item).name}`;
	}
	function startDrag(event: DragEvent, item: InventorySlot) {
		if (
			!backpack ||
			item.empty ||
			moving ||
			pointerGesture ||
			!event.dataTransfer
		) {
			event.preventDefault();
			return;
		}
		if (selectedEntity !== item.entityId) choose(item.entityId);
		dragSource = {
			farmerId: backpack.farmerId,
			entityId: item.entityId,
			location: isEquipment(item) ? item.key : "backpack",
		};
		// A drag carries only this panel's token. External text/files/windows cannot
		// manufacture an inventory operation, and saved item data never enters the payload.
		event.dataTransfer.setData(dragType, dragToken);
		event.dataTransfer.effectAllowed = "move";
	}
	function acceptsDrop(item: InventorySlot) {
		const owner = backpacks.find(
			(owner) => owner.farmerId === dragSource?.farmerId,
		);
		const source =
			owner &&
			allSlots(owner).find((entry) => entry.entityId === dragSource?.entityId);
		if (!source) return false;
		// The shared positive equipment policy supplies only a cursor hint here.
		// The command rechecks both directions against current records at commit.
		if (
			isEquipment(item) &&
			(item.locked || !source.raw || !canEquipItem(source.raw, item.key))
		)
			return false;
		return (
			!isEquipment(source) || item.empty || canEquipItem(item.raw, source.key)
		);
	}
	function dragOver(event: DragEvent, item: InventorySlot) {
		if (!dragSource || moving || !event.dataTransfer?.types.includes(dragType))
			return;
		event.preventDefault();
		event.dataTransfer.dropEffect = acceptsDrop(item) ? "move" : "none";
		dropEntity = acceptsDrop(item) ? item.entityId : undefined;
	}
	function drop(event: DragEvent, item: InventorySlot) {
		const source = dragSource;
		if (
			!source ||
			moving ||
			event.dataTransfer?.getData(dragType) !== dragToken
		)
			return;
		event.preventDefault();
		void moveItem(item, source);
	}
	function pointerDown(event: PointerEvent, item: InventorySlot) {
		ignorePointerClick = false;
		if (
			!backpack ||
			item.empty ||
			moving ||
			pointerGesture ||
			!["touch", "pen"].includes(event.pointerType)
		)
			return;
		// Touch/pen use the same drag operation as desktop, but wait for deliberate
		// movement so a tap still selects the item normally.
		pointerGesture = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			dragging: false,
			source: {
				farmerId: backpack.farmerId,
				entityId: item.entityId,
				location: isEquipment(item) ? item.key : "backpack",
			},
		};
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
	}
	function pointerTarget(event: PointerEvent) {
		const control = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest<HTMLElement>("[data-inventory-entity]");
		if (!control || !inventory?.contains(control) || !backpack)
			return undefined;
		return allSlots(backpack).find(
			(item) => item.entityId === control.dataset.inventoryEntity,
		);
	}
	function pointerMove(event: PointerEvent) {
		const gesture = pointerGesture;
		if (!gesture || gesture.id !== event.pointerId) return;
		if (
			!gesture.dragging &&
			Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 8
		)
			return;
		if (!gesture.dragging) {
			if (selectedEntity !== gesture.source.entityId)
				choose(gesture.source.entityId);
			gesture.dragging = true;
			dragSource = gesture.source;
		}
		event.preventDefault();
		const target = pointerTarget(event);
		dropEntity = target && acceptsDrop(target) ? target.entityId : undefined;
	}
	function pointerUp(event: PointerEvent) {
		const gesture = pointerGesture;
		if (!gesture || gesture.id !== event.pointerId) return;
		pointerGesture = undefined;
		if (!gesture.dragging) return;
		// Hit-test the release position because pointer capture keeps delivery on
		// the source button. Suppress its synthetic click after a completed drag.
		ignorePointerClick = true;
		const target = pointerTarget(event);
		if (target) void moveItem(target, gesture.source);
		else {
			dragSource = undefined;
			dropEntity = undefined;
		}
	}
	function pointerCancel() {
		// Native mouse drag cancels its preceding pointer stream too; only a real
		// touch/pen gesture owns this cleanup, or desktop drag state would be lost.
		if (!pointerGesture) return;
		// Browser cancellation/scroll takeover must never publish a partial drag.
		pointerGesture = undefined;
		dragSource = undefined;
		dropEntity = undefined;
	}
	async function moveItem(item: InventorySlot, source: DragSource) {
		if (!backpack || moving) return;
		const version = selectionVersion;
		const destinationOwner = backpack.farmerId;
		moving = true;
		operationError = "";
		try {
			// Both endpoint handles are rechecked in the queue. Equipment policy checks
			// both exchanged records; the UI never writes optimistic slot replacements.
			const result = await model.commands.moveBackpackItem({
				type: "backpack-move",
				farmerId: source.farmerId,
				entityId: source.entityId,
				toFarmerId: destinationOwner,
				toEntityId: item.entityId,
				fromLocation: source.location,
				toLocation: isEquipment(item) ? item.key : "backpack",
			});
			if (!result) return;
			if (Result.isFailure(result)) {
				if (selectionVersion === version)
					operationError = result.failure.message;
				return;
			}
			if (selectionVersion === version) {
				selectedEntity = result.success.entityId;
				selectionFamily = [
					...new Set([...selectionFamily, result.success.entityId]),
				];
				dragSource = undefined;
				moving = false;
				await focusSelected(version);
			}
		} finally {
			moving = false;
			dragSource = undefined;
			dropEntity = undefined;
		}
	}
	async function changeSlot(kind: "add" | "remove", catalogId?: string) {
		if (!backpack || !selected || isEquipment(selected)) return false;
		const owner = backpack.farmerId;
		const target = selected;
		const version = selectionVersion;
		const invokingControl = document.activeElement;
		operationError = "";
		if (kind === "add" && catalogId === undefined) return false;
		const result = await model.commands.changeBackpackSlot(
			kind === "add"
				? {
						type: "backpack-add",
						farmerId: owner,
						entityId: target.entityId,
						catalogId: catalogId!,
					}
				: {
						type: "backpack-remove",
						farmerId: owner,
						entityId: target.entityId,
					},
		);
		if (!result) return false;
		if (Result.isFailure(result)) {
			if (selectionVersion === version) operationError = result.failure.message;
			return false;
		}
		// The exact committed replacement pair keeps selection stable even if a later
		// queued Undo runs before this callback completes. Later user selection wins.
		if (selectionVersion === version && backpack?.farmerId === owner) {
			selectionFamily = [...selectionFamily, result.success.entityId];
			selectedEntity = result.success.entityId;
			await tick();
			if (
				kind === "add" &&
				(document.activeElement === invokingControl ||
					document.activeElement === document.body)
			)
				await focusSelected(version);
		}
		return true;
	}
	async function removeSelected() {
		if (removing) return;
		removing = true;
		try {
			await changeSlot("remove");
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
		class:drop-target={dropEntity === item.entityId}
		aria-pressed={selected?.entityId === item.entityId}
		aria-label={slotLabel(item)}
		data-inventory-entity={item.entityId}
		title={isEquipment(item) && item.locked
			? `${slotLabel(item)} (locked)`
			: slotLabel(item)}
		disabled={moving}
		draggable={!item.empty && !moving}
		onclick={(event) => {
			if (ignorePointerClick && event.detail !== 0) {
				ignorePointerClick = false;
				return;
			}
			choose(item.entityId);
		}}
		onpointerdown={(event) => pointerDown(event, item)}
		onpointermove={pointerMove}
		onpointerup={pointerUp}
		onpointercancel={pointerCancel}
		ondragstart={(event) => startDrag(event, item)}
		ondragover={(event) => dragOver(event, item)}
		ondragleave={() => {
			if (dropEntity === item.entityId) dropEntity = undefined;
		}}
		ondrop={(event) => void drop(event, item)}
		ondragend={() => {
			dragSource = undefined;
			dropEntity = undefined;
		}}
	>
		{#if !isEquipment(item)}
			<span class="slot-number" aria-hidden="true">{item.slot + 1}</span>
		{/if}
		{#if !item.empty}
			<BackpackItemVisual raw={item.raw} />
		{:else if isEquipment(item)}
			<span class="empty-equipment" aria-hidden="true"></span>
		{/if}
		{#if !isEquipment(item) && item.stack !== undefined && item.stack > 1}
			<span class="quantity" aria-hidden="true">{item.stack}</span>
		{/if}
	</button>
{/snippet}

<div class="inventory-heading">
	<h1>Inventory</h1>
	{#if backpacks.length > 1}
		<label class="farmer">
			Farmer
			<select
				bind:value={
					() => farmerIndex,
					(value) => {
						farmerIndex = value;
						choose(undefined);
					}
				}
			>
				{#each backpacks as farmer, index (index)}
					<option value={index}>{farmer.name}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>
{#if !backpack || !backpack.supported}
	<p role="status">
		{backpack?.reason ?? "No supported backpack is available."} Other save settings
		remain available.
	</p>
{:else}
	<div class="inventory-layout" class:browsing bind:this={inventory}>
		<div class="possessions">
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
				</div>
				<div class="slots">
					{#each backpack.slots as item (item.entityId)}
						{@render slot(item)}
					{/each}
				</div>
			</section>
		</div>
		<div class="inspector" class:browsing>
			{#if selected && !selected.empty}
				{@const details = display(selected)}
				{#key JSON.stringify([backpack.farmerId, selected.entityId])}
					<BackpackItemEditor
						{model}
						farmerId={backpack.farmerId}
						item={selected}
						{...details}
						locationLabel={isEquipment(selected) ? selected.label : undefined}
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
					entries={catalogEntries}
					error={operationError}
					onadd={(id) => changeSlot("add", id)}
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
	.farmer {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	select {
		font: inherit;
		min-height: 40px;
		max-width: 220px;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		padding: 4px 8px;
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
		.farmer {
			font-size: 17px;
			gap: 6px;
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
