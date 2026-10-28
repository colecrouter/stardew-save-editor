<script lang="ts">
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
	let selectedEntity = $state<string>();
	const backpacks = $derived(view.current?.backpacks ?? []);
	const backpack = $derived(backpacks[farmerIndex]);
	// Selection follows the session entity through reorders and undo. An entity
	// leaving this farmer stays unavailable rather than selecting its replacement.
	const selected = $derived(
		selectedEntity === undefined
			? (backpack?.slots.find((slot) => !slot.empty) ?? backpack?.slots[0])
			: backpack?.slots.find((slot) => slot.entityId === selectedEntity),
	);
	$effect(() => {
		// Pin the initial instance too: a later reorder must not turn the implicit
		// first-slot selection into a different entity before the user's first click.
		if (selectedEntity === undefined && backpack?.slots.length)
			selectedEntity = (
				backpack.slots.find((slot) => !slot.empty) ?? backpack.slots[0]
			)?.entityId;
	});
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

<h1>Backpack</h1>
<p>
	Select an item to edit its quantity or quality. Use Undo to revert changes.
</p>
{#if backpacks.length > 1}
	<label class="farmer"
		>Farmer
		<select
			value={farmerIndex}
			onchange={(event) => {
				farmerIndex = Number(event.currentTarget.value);
				selectedEntity = undefined;
			}}
		>
			{#each backpacks as farmer, index (index)}<option value={index}
					>{farmer.name}</option
				>{/each}
		</select>
	</label>
{/if}
{#if !backpack || !backpack.supported}
	<p role="status">
		{backpack?.reason ?? "No supported backpack is available."} Other save settings
		remain available.
	</p>
{:else}
	<div class="inventory-layout">
		<section aria-label={`${backpack.name}'s backpack`}>
			<h2>{backpack.name}’s backpack</h2>
			<!-- Slot position stays in the upper corner; quality and quantity identify
			     the saved item instance along the lower edge. -->
			<div class="slots">
				{#each backpack.slots as item (item.entityId)}
					{@const details = display(item)}
					<button
						type="button"
						class="slot"
						class:active={selected?.entityId === item.entityId}
						aria-pressed={selected?.entityId === item.entityId}
						aria-label={`Slot ${item.slot + 1}: ${item.empty ? "Empty" : details.name}`}
						title={item.empty ? "Empty slot" : details.name}
						onclick={() => {
							selectedEntity = item.entityId;
						}}
					>
						<span class="slot-number" aria-hidden="true">{item.slot + 1}</span>
						{#if !item.empty}<BackpackItemVisual raw={item.raw} />{/if}
						{#if item.stack !== undefined && item.stack > 1}<span
								class="quantity"
								aria-hidden="true">{item.stack}</span
							>{/if}
					</button>
				{/each}
			</div>
		</section>
		<div class="inspector">
			{#if selected && !selected.empty}
				{@const details = display(selected)}
				{#key JSON.stringify([backpack.farmerId, selected.entityId])}
					<BackpackItemEditor
						{model}
						farmerId={backpack.farmerId}
						item={selected}
						{...details}
					/>
				{/key}
			{:else}<p role="status">
					{selected?.empty
						? "This slot is empty."
						: "The selected item is no longer in this backpack. Select another slot."}
				</p>{/if}
		</div>
	</div>
{/if}

<style>
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
