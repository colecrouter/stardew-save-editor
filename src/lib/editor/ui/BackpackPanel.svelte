<script lang="ts">
	import { tick } from "svelte";
	import { Result } from "effect";
	import { catalogEntries } from "../item-catalog.ts";
	import BackpackItemPicker from "./BackpackItemPicker.svelte";
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
		getBackpackItemCapabilities,
		type BackpackSlotView,
	} from "../inventory-operations.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import BackpackItemEditor from "./BackpackItemEditor.svelte";
	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	let farmerIndex = $state(0);
	const backpacks = $derived(view.current?.backpacks ?? []);
	const backpack = $derived(backpacks[farmerIndex]);
	let selectedEntity = $state<string>();
	let selectionFamily = $state<string[]>([]);
	let selectionVersion = 0;
	let operationError = $state("");
	let removing = $state(false);
	let slotGrid = $state<HTMLDivElement>();
	interface MoveSource {
		farmerId: string;
		farmerName: string;
		item: BackpackSlotView;
		name: string;
	}
	let moveSource = $state<MoveSource>();
	let dragSource = $state<MoveSource>();
	let movePending = $state(false);
	let dropEntity = $state<string>();
	const dragToken = $props.id();
	const dragType = "application/x-stardew-backpack-item";
	const activeSource = $derived(moveSource ?? dragSource);
	// Undo/reorder can change the source's slot while Move mode is open. Keep the
	// pinned owner/handle, but show its current position and sprite in the banner.
	const currentSource = $derived(
		activeSource &&
			backpacks
				.find(
					(owner) =>
						owner.supported && owner.farmerId === activeSource.farmerId,
				)
				?.slots.find((item) => item.entityId === activeSource.item.entityId),
	);
	const sourceAvailable = $derived(
		currentSource !== undefined && !currentSource.empty,
	);
	// Explicit selection starts a new lineage. Add/remove replace a slot's handle;
	// remembering those related handles lets Undo/Redo restore the same selection
	// without accidentally selecting an unrelated replacement.
	function choose(entityId: string | undefined) {
		selectionVersion++;
		dragSource = undefined;
		dropEntity = undefined;
		selectedEntity = entityId;
		selectionFamily = entityId ? [entityId] : [];
		operationError = "";
	}
	// Selection follows the session entity through reorders, owner transfers and
	// Undo. Only our own add/remove replacements extend its lineage. Explicitly
	// choosing another farmer still starts a new selection within that backpack.
	const selected = $derived(
		selectedEntity === undefined
			? (backpack?.slots.find((slot) => !slot.empty) ?? backpack?.slots[0])
			: (backpack?.slots.find((slot) => slot.entityId === selectedEntity) ??
					backpack?.slots.find((slot) =>
						selectionFamily.includes(slot.entityId),
					)),
	);
	$effect(() => {
		// Pin the initial instance too: a later reorder must not turn the implicit
		// first-slot selection into a different entity before the user's first click.
		if (selectedEntity === undefined && backpack?.slots.length) {
			selectedEntity = (
				backpack.slots.find((slot) => !slot.empty) ?? backpack.slots[0]
			)?.entityId;
			selectionFamily = selectedEntity ? [selectedEntity] : [];
		}
	});
	$effect(() => {
		// A moved item's handle travels with its complete record. Follow that handle
		// across owners after commit and Undo/Redo, but leave destination browsing
		// under the user's control while a move is being prepared.
		if (!moveSource && !dragSource && selectedEntity) {
			const owner = backpacks.findIndex(
				(owner) =>
					owner.supported &&
					owner.slots.some(
						(slot) =>
							slot.entityId === selectedEntity ||
							selectionFamily.includes(slot.entityId),
					),
			);
			if (owner >= 0 && owner !== farmerIndex) farmerIndex = owner;
		}
	});
	function captureSource(item: BackpackSlotView): MoveSource | undefined {
		return backpack && !item.empty
			? {
					farmerId: backpack.farmerId,
					farmerName: backpack.name,
					item,
					name: display(item).name,
				}
			: undefined;
	}
	function beginMove() {
		if (!selected || movePending) return;
		moveSource = captureSource(selected);
		operationError = "";
		// The inspector action disappears in move mode. Put keyboard focus on its
		// selected source slot so the next Tab reaches a destination immediately.
		void focusSelected();
	}
	async function focusSelected(version = selectionVersion) {
		await tick();
		if (selectionVersion !== version || slotGrid?.closest("[hidden]")) return;
		slotGrid
			?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
			?.focus();
	}
	async function cancelMove() {
		if (movePending) return;
		moveSource = undefined;
		dragSource = undefined;
		dropEntity = undefined;
		operationError = "";
		await focusSelected();
	}
	function destinationLabel(item: BackpackSlotView) {
		const name = item.empty ? "Empty" : display(item).name;
		if (!activeSource) return `Slot ${item.slot + 1}: ${name}`;
		if (
			backpack?.farmerId === activeSource.farmerId &&
			item.entityId === activeSource.item.entityId
		)
			return `Source slot ${item.slot + 1}: ${name}`;
		return item.empty
			? `Move ${activeSource.name} to slot ${item.slot + 1}: Empty`
			: `Swap ${activeSource.name} with slot ${item.slot + 1}: ${name}`;
	}
	async function moveTo(item: BackpackSlotView, source = activeSource) {
		if (!source || !backpack || movePending) return;
		const destinationOwner = backpack.farmerId;
		const version = selectionVersion;
		movePending = true;
		operationError = "";
		try {
			// Both ends use captured handles. The queued command validates ownership,
			// available slots and the current destination before moving or swapping.
			const result = await model.commands.moveBackpackItem({
				type: "backpack-move",
				farmerId: source.farmerId,
				entityId: source.item.entityId,
				toFarmerId: destinationOwner,
				toEntityId: item.entityId,
			});
			if (!result) return;
			if (Result.isFailure(result)) {
				if (selectionVersion === version)
					operationError = result.failure.message;
				return;
			}
			if (selectionVersion === version) {
				moveSource = undefined;
				dragSource = undefined;
				selectedEntity = result.success.entityId;
				selectionFamily = [
					...new Set([...selectionFamily, result.success.entityId]),
				];
				const destination = backpacks.findIndex(
					(owner) => owner.farmerId === result.success.farmerId,
				);
				if (destination >= 0) farmerIndex = destination;
				// Enable the destination before focusing it: a disabled button cannot
				// receive focus, and an ensuing explicit selection must still win.
				movePending = false;
				await focusSelected(version);
			}
		} finally {
			movePending = false;
			dropEntity = undefined;
		}
	}
	function startDrag(event: DragEvent, item: BackpackSlotView) {
		const source = captureSource(item);
		if (!source || moveSource || movePending || !event.dataTransfer) {
			event.preventDefault();
			return;
		}
		if (selectedEntity !== item.entityId) choose(item.entityId);
		dragSource = source;
		// Only drags started by this mounted backpack panel may write to it. Text,
		// files and other windows cannot manufacture an inventory command payload.
		event.dataTransfer.setData(dragType, dragToken);
		event.dataTransfer.effectAllowed = "move";
	}
	function dragOver(event: DragEvent, item: BackpackSlotView) {
		if (
			!dragSource ||
			movePending ||
			!event.dataTransfer?.types.includes(dragType)
		)
			return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		dropEntity = item.entityId;
	}
	function drop(event: DragEvent, item: BackpackSlotView) {
		const source = dragSource;
		if (!source || event.dataTransfer?.getData(dragType) !== dragToken) return;
		event.preventDefault();
		void moveTo(item, source);
	}

	async function changeSlot(kind: "add" | "remove", catalogId?: string) {
		if (!backpack || !selected) return false;
		const owner = backpack.farmerId;
		const target = selected;
		const version = selectionVersion;
		const invokingControl = document.activeElement;
		operationError = "";
		// Pass an instance handle, never a slot index from the view. The queued
		// command rechecks both ownership and emptiness before changing anything.
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
		// A later click or owner switch wins over completion of an earlier edit.
		// Only our own replacement extends the lineage used by Undo/Redo selection.
		if (selectionVersion === version && backpack?.farmerId === owner) {
			const replacement = result.success.entityId;
			if (replacement) {
				selectionFamily = [...selectionFamily, replacement];
				selectedEntity = replacement;
				await tick();
				// Added items return focus to their slot. Removal opens the picker's
				// search instead; later toolbar actions keep their own focus.
				if (
					kind === "add" &&
					(document.activeElement === invokingControl ||
						document.activeElement === document.body)
				)
					slotGrid
						?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
						?.focus();
			}
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

	function display(item: BackpackSlotView) {
		let info: ReturnType<typeof ResolveItemData>;
		let name = item.name;
		try {
			if (item.raw) {
				info = ResolveItemData(item.raw as unknown as Item);
				name = ItemNameHelper(item.raw as unknown as Item) ?? name;
			}
		} catch {
			// Malformed/unknown imported records remain selectable without invoking
			// a proxy constructor or repairing any of their serialized fields.
		}
		const capabilities = getBackpackItemCapabilities(
			item.raw,
			info?._type === "Object",
			CategoriesWithQuality.has(item.raw?.category as never),
		);
		return { name, description: ItemDescription(info), ...capabilities };
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (
			event.key === "Escape" &&
			moveSource &&
			!movePending &&
			!slotGrid?.closest("[hidden]")
		) {
			event.preventDefault();
			void cancelMove();
		}
	}}
/>

<h1>Backpack</h1>
<p>
	Select an item to edit it, or choose an empty slot to add something. Use Undo
	to revert changes.
</p>
{#if backpacks.length > 1}
	<label class="farmer">
		{moveSource ? "Destination backpack" : "Farmer"}
		<select
			disabled={movePending}
			bind:value={
				() => farmerIndex,
				(value) => {
					// Changing owners starts selection within the new backpack rather
					// than carrying another farmer's entity handle into its inspector.
					farmerIndex = value;
					if (!moveSource) choose(undefined);
				}
			}
		>
			{#each backpacks as farmer, index (index)}
				<option
					value={index}
					disabled={moveSource !== undefined && !farmer.supported}
				>
					{farmer.name}{moveSource && !farmer.supported ? " (unavailable)" : ""}
				</option>
			{/each}
		</select>
	</label>
{/if}
{#if !backpack || !backpack.supported}
	<p role="status">
		{backpack?.reason ?? "No supported backpack is available."} Other save settings
		remain available.
	</p>
{:else}
	{#if moveSource}
		<section class="move-banner" aria-label="Move backpack item">
			<div class="source-icon">
				<BackpackItemVisual raw={currentSource?.raw ?? moveSource.item.raw} />
			</div>
			<div class="move-guidance">
				<h2>Move {moveSource.name}</h2>
				<p>
					From {moveSource.farmerName}’s backpack, slot {(currentSource?.slot ??
						moveSource.item.slot) + 1}.
				</p>
				<p role="status">
					{sourceAvailable
						? "Choose an empty slot to move, or an item to swap. Undo restores both slots."
						: "This item is no longer available in its source backpack. Cancel and select it again."}
				</p>
			</div>
			<button
				type="button"
				class="cancel-move"
				disabled={movePending}
				onclick={() => void cancelMove()}
			>
				Cancel move
			</button>
		</section>
	{/if}
	<div
		class="inventory-layout"
		class:browsing={selected?.empty && !moveSource}
		class:moving={moveSource !== undefined}
	>
		<section aria-label={`${backpack.name}'s backpack`}>
			<h2>{backpack.name}’s backpack</h2>
			<!-- Slot position stays in the upper corner; quality and quantity identify
			     the saved item instance along the lower edge. -->
			<div class="slots" bind:this={slotGrid}>
				{#each backpack.slots as item (item.entityId)}
					{@const details = display(item)}
					<button
						type="button"
						class="slot"
						class:active={selected?.entityId === item.entityId}
						class:drop-target={dropEntity === item.entityId}
						class:move-source={activeSource?.item.entityId === item.entityId}
						aria-pressed={selected?.entityId === item.entityId}
						aria-label={destinationLabel(item)}
						title={destinationLabel(item)}
						disabled={movePending || (!!moveSource && !sourceAvailable)}
						draggable={!item.empty && !moveSource && !movePending}
						ondragstart={(event) => startDrag(event, item)}
						ondragover={(event) => dragOver(event, item)}
						ondragleave={() => {
							if (dropEntity === item.entityId) dropEntity = undefined;
						}}
						ondrop={(event) => drop(event, item)}
						ondragend={() => {
							dragSource = undefined;
							dropEntity = undefined;
						}}
						onclick={() => {
							if (moveSource) void moveTo(item);
							else choose(item.entityId);
						}}
					>
						<span class="slot-number" aria-hidden="true">{item.slot + 1}</span>
						{#if !item.empty}
							<BackpackItemVisual raw={item.raw} />
						{/if}
						{#if item.stack !== undefined && item.stack > 1}
							<span class="quantity" aria-hidden="true">
								{item.stack}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		</section>
		<div
			class="inspector"
			class:browsing={selected?.empty && !moveSource}
			class:move-inspector={moveSource !== undefined}
		>
			{#if moveSource}
				<p class="move-destination">
					{backpack.slots.length} slots in {backpack.name}’s backpack. Occupied
					slots swap whole items; quantities are not merged.
				</p>
			{:else if selected && !selected.empty}
				{@const details = display(selected)}
				{#key JSON.stringify([backpack.farmerId, selected.entityId])}
					<BackpackItemEditor
						{model}
						farmerId={backpack.farmerId}
						item={selected}
						{...details}
						onmove={beginMove}
						onremove={removeSelected}
						{removing}
					/>
				{/key}
			{:else if selected?.empty}
				<BackpackItemPicker
					slot={selected.slot}
					entries={catalogEntries}
					error={operationError}
					onadd={(id) => changeSlot("add", id)}
				/>
			{:else}
				<p role="status">
					The selected item is no longer in this backpack. Select another slot.
				</p>
			{/if}
			{#if operationError && (!selected?.empty || moveSource)}
				<p role="status">{operationError}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.move-banner {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		margin-top: 24px;
		padding: 20px 0;
		border-block: 1px solid #be8d4d;
	}
	.move-banner h2 {
		margin: 0 0 8px;
	}
	.move-banner p {
		margin: 6px 0 0;
	}
	.move-guidance {
		flex: 1;
		min-width: 0;
	}
	.move-banner [role="status"],
	.move-destination {
		color: #694621;
		font-size: 19px;
	}
	.source-icon {
		width: 48px;
		min-width: 48px;
		display: grid;
		place-items: center;
		padding-top: 4px;
	}
	.cancel-move {
		font: inherit;
		min-height: 44px;
		padding: 6px 12px;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		cursor: pointer;
	}
	.cancel-move:focus-visible,
	.slot:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 3px;
	}
	.slot[draggable="true"] {
		cursor: grab;
	}
	.slot.move-source {
		border-style: dashed;
	}
	.slot.drop-target {
		border-color: #176fb4;
		background: #cce5ef;
		outline: 2px solid #176fb4;
		outline-offset: 1px;
	}
	.slot:disabled {
		cursor: wait;
	}
	.inventory-layout.moving {
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
	}
	.inspector.move-inspector {
		border: 0;
		padding: 0;
	}
	.move-destination {
		margin: 0;
	}
	@media (max-width: 600px) {
		.move-banner {
			flex-wrap: wrap;
		}
		.move-guidance {
			/* Reserve the first row for the icon and readable source text; the
			   Cancel button belongs below them on narrow screens. */
			flex-basis: calc(100% - 64px);
		}
		.cancel-move {
			margin-left: 64px;
		}
	}

	.farmer {
		display: grid;
		gap: 6px;
		max-width: 320px;
		margin: 20px 0;
	}
	select {
		font: inherit;
		min-height: 44px;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		padding: 5px 8px;
	}
	.inventory-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
		gap: 32px;
		align-items: start;
		margin-top: 24px;
	}
	.inventory-layout.browsing {
		grid-template-columns: minmax(0, 1fr);
	}
	.inspector.browsing {
		border-left: 0;
		border-top: 1px solid #be8d4d;
		padding: 24px 0 0;
	}
	.inventory-layout section {
		min-width: 0;
	}
	h2 {
		margin: 0 0 16px;
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
		padding: 2px;
		border: 2px solid #b98b52;
		background: #f7d7a4;
		cursor: pointer;
	}
	.slot:hover {
		background: #fff0d3;
	}
	.slot.active {
		background: #b5d6e7;
		border-color: #176fb4;
	}
	.slot-number {
		position: absolute;
		top: 1px;
		left: 3px;
		font-size: 14px;
		color: #694621;
	}
	.quantity {
		position: absolute;
		bottom: 0;
		right: 2px;
		font-size: 17px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		/* Outline the count itself so it remains legible over sprites without
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
	@media (max-width: 1300px) {
		.inventory-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.inspector {
			border-left: 0;
			border-top: 1px solid #be8d4d;
			padding: 24px 0 0;
		}
	}
	@media (max-width: 600px) {
		.slots {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
