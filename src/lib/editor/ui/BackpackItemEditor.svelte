<script lang="ts">
	import { inventoryQualities } from "../inventory-policy.ts";
	import { createImmediateFieldController } from "../immediate-field.svelte.ts";
	import { createInventoryQuantityFields } from "../inventory-domain.ts";
	import NumberField from "./fields/NumberField.svelte";
	import type { ItemInformation } from "$types/items";
	import type { TrinketRollContext } from "../../TrinketStats.ts";
	import ItemPropertyControls from "./ItemPropertyControls.svelte";
	import { getItemPropertyFields } from "../item-properties.ts";
	import type { EquipmentSlotView } from "../equipment.ts";
	import type { EditorModel } from "../editor-model.ts";
	import { type BackpackSlotView } from "../inventory-operations.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import QualityBadge from "./QualityBadge.svelte";

	interface Props {
		model: EditorModel;
		farmerId: string;
		item: BackpackSlotView | EquipmentSlotView;
		locationLabel?: string;
		inventoryKind?: "backpack" | "chest";
		name: string;
		description?: string;
		metadata?: Pick<ItemInformation, "_type">;
		propertyContext?: TrinketRollContext;
		canStack: boolean;
		canQuality: boolean;
		onremove?: () => Promise<void>;
		removing?: boolean;
	}
	let {
		model,
		farmerId,
		item,
		name,
		description,
		metadata,
		propertyContext,
		canStack,
		canQuality,
		locationLabel,
		inventoryKind = "backpack",
		onremove,
		removing = false,
	}: Props = $props();
	// A location caption is display context, never evidence that an item is equipped.
	const equipmentItem = $derived("key" in item);
	const qualityGroup = $props.id();
	const fields = $derived(
		createInventoryQuantityFields(model, farmerId, item, canStack, canQuality),
	);
	// The radio presentation shares the same lifecycle/error controller as ordinary
	// fields. Each quality choice is discrete even while keyboard focus stays here.
	const qualityEditing = createImmediateFieldController(() => fields.quality, {
		discrete: true,
	});
	// Deriving controls must not add missing save fields or repair imported values.
	const itemFields = $derived(
		getItemPropertyFields(item.raw, metadata, propertyContext),
	);
	const guidance = $derived(
		canStack || canQuality || itemFields.length > 0
			? "Changes update immediately. Use Undo to revert."
			: "",
	);
	const qualities = inventoryQualities;
</script>

<section
	aria-label={equipmentItem
		? "Selected equipment item"
		: inventoryKind === "chest"
			? "Selected chest item"
			: "Selected backpack item"}
	class="inspector"
>
	<header>
		<div class="large-icon"><BackpackItemVisual raw={item.raw} /></div>
		<div>
			<h2>{name}</h2>
			<p class="slot-label">
				{locationLabel ?? `Slot ${"slot" in item ? item.slot + 1 : ""}`}
			</p>
		</div>
	</header>
	{#if description}
		<p class="description">{description}</p>
	{/if}
	<!-- Equipment is inspected in its named slot. Its saved stack/quality defaults
	     are not editing controls; quantity and quality belong to supported inventory items. -->
	{#if !equipmentItem && (canStack || canQuality || itemFields.length === 0)}
		<div class="properties">
			{#if canStack}
				<NumberField field={fields.quantity} />
			{:else if item.stack !== undefined}
				<p>Quantity: {item.stack}</p>
			{/if}
			{#if canQuality}
				<!-- Native radio grouping preserves focus and arrow-key selection while
			     each discrete choice enters the serialized command queue. -->
				<fieldset aria-busy={qualityEditing.pending} class="quality-picker">
					<legend>Quality</legend>

					{#if !qualities.some((quality) => quality.value === item.quality)}
						<p class="custom-quality">Current: Custom ({item.quality})</p>
					{/if}

					<div class="quality-options">
						{#each qualities as quality (quality.value)}
							<label class="quality-choice">
								<input
									type="radio"
									name={qualityGroup}
									value={quality.value}
									checked={qualityEditing.value === quality.value}
									onchange={() => qualityEditing.input(quality.value)}
								/>

								<span class="quality-symbol" aria-hidden="true">
									{#if quality.value === 0}
										<svg viewBox="0 0 10 10" width="20" height="20">
											<path
												d="M4 1h2v2h1v1h2v2H7v1h1v2H6V8H4v1H2V7h1V6H1V4h2V3h1Z"
												fill="none"
												stroke="currentColor"
											/>
										</svg>
									{:else}
										<QualityBadge quality={quality.value} />
									{/if}
								</span>

								<span>{quality.label}</span>
							</label>
						{/each}
					</div>
					{#if qualityEditing.error}
						<p role="status">{qualityEditing.error}</p>
					{/if}
				</fieldset>
			{:else if item.quality !== undefined}
				<p>Quality: {item.quality}</p>
			{/if}
		</div>
	{/if}
	<!-- Saved item properties apply to the instance regardless of whether it is
	     currently in a backpack, chest or equipped on the farmer. -->
	<ItemPropertyControls
		{model}
		{farmerId}
		entityId={item.entityId}
		fields={itemFields}
	/>

	{#if !equipmentItem && !canStack && !canQuality && itemFields.length === 0}
		<p>
			Quantity and quality are preserved but cannot be edited for this item.
		</p>
	{/if}
	{#if guidance}
		<p class="guidance">{guidance}</p>
	{/if}
	{#if onremove}
		<!-- Removal is immediately undoable, like the other independent controls. -->
		<div class="remove-action">
			<button
				type="button"
				disabled={removing}
				onclick={() => void onremove?.()}
			>
				{removing ? "Removing…" : "Remove item"}
			</button>
			<p>Undo restores the complete item.</p>
		</div>
	{/if}
</section>

<style>
	.remove-action {
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid #be8d4d;
	}
	.remove-action button {
		font: inherit;
		min-height: 44px;
		padding: 6px 14px;
		background: #fff2d3;
		color: #8c2f1b;
		border: 2px solid #a55832;
		cursor: pointer;
	}
	.remove-action button:hover {
		background: #ffe4c7;
	}
	.remove-action button:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 3px;
	}
	.remove-action p {
		font-size: 19px;
		color: #694621;
		margin: 8px 0 0;
	}
	.inspector {
		min-width: 0;
	}
	header {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	h2 {
		margin: 0 0 8px;
		overflow-wrap: anywhere;
	}
	.large-icon {
		flex: none;
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
	}
	.large-icon :global(.visual) {
		transform: scale(2);
	}
	.slot-label {
		margin: 0;
		color: #694621;
	}
	.description {
		white-space: pre-line;
		max-width: 65ch;
	}
	.properties {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
		margin-top: 24px;
	}
	label {
		display: grid;
		gap: 8px;
		min-width: 0;
	}

	.quality-picker {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 8px;
	}
	.quality-options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.quality-choice {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 6px 10px;
		border: 2px solid #b98b52;
		background: #fff2d3;
		cursor: pointer;
	}
	.quality-choice:hover {
		background: #fff8e8;
	}
	.quality-choice:has(input:checked) {
		border-color: #176fb4;
		background: #b5d6e7;
	}
	.quality-choice:has(input:focus-visible) {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	.quality-choice input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.quality-symbol {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		flex: none;
		color: #694621;
	}
	.quality-symbol :global(svg) {
		width: 20px;
		height: 20px;
	}
	.quality-picker[aria-busy="true"] .quality-choice {
		cursor: wait;
		opacity: 0.65;
	}
	.custom-quality {
		margin: 0 0 8px;
		color: #694621;
	}

	.guidance,
	[role="status"] {
		margin-top: 24px;
		font-size: 19px;
		color: #694621;
	}
	@media (max-width: 600px) {
		.large-icon {
			width: 48px;
			height: 48px;
		}
		.large-icon :global(.visual) {
			transform: scale(1.5);
		}
		header {
			gap: 12px;
		}
		h2 {
			font-size: 24px;
		}
		.description,
		.properties,
		.guidance,
		[role="status"],
		.remove-action {
			font-size: 18px;
		}
		.properties {
			margin-top: 16px;
		}
		.guidance,
		[role="status"] {
			margin-top: 16px;
		}
	}
</style>
