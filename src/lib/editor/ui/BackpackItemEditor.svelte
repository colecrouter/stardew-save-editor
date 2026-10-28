<script lang="ts">
	import { Result } from "effect";
	import type { EditorModel } from "../editor-model.ts";
	import {
		setBackpackItem,
		decodeBackpackItemChange,
		type BackpackSlotView,
	} from "../inventory-operations.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";

	interface Props {
		model: EditorModel;
		farmerId: string;
		item: BackpackSlotView;
		name: string;
		description?: string;
		canStack: boolean;
		canQuality: boolean;
	}
	let {
		model,
		farmerId,
		item,
		name,
		description,
		canStack,
		canQuality,
	}: Props = $props();
	let quantity = $state("");
	let savingQuantity = $state(false);
	let savingQuality = $state(false);
	let error = $state("");
	const committedQuantity = $derived(item.stack);
	$effect(() => {
		quantity = committedQuantity === undefined ? "" : String(committedQuantity);
	});
	const guidance = $derived(
		canStack && canQuality
			? "Quantity updates when you leave the field or press Enter. Quality updates immediately. Use Undo to revert."
			: canStack
				? "Quantity updates when you leave the field or press Enter. Use Undo to revert."
				: canQuality
					? "Quality updates immediately. Use Undo to revert."
					: "",
	);
	const qualities = [
		{ value: 0, label: "Normal" },
		{ value: 1, label: "Silver" },
		{ value: 2, label: "Gold" },
		{ value: 4, label: "Iridium" },
	];

	async function update(property: "stack" | "quality", value: number) {
		error = "";
		// The enclosing keyed inspector owns this farmer/entity pair. Capture it
		// before the await: a later selection must never retarget a pending edit.
		const decoded = decodeBackpackItemChange({
			farmerId,
			entityId: item.entityId,
			property,
			value,
		});
		if (Result.isFailure(decoded)) {
			error = decoded.failure.message;
			return;
		}
		// Field feedback and the command boundary share one schema; the command
		// additionally rechecks ownership/eligibility against the current document.
		const result = await model.commands.transact(
			setBackpackItem(decoded.success),
		);
		if (result && Result.isFailure(result)) error = result.failure.message;
		// Defects/cancellation remain with the shared session/toast boundary.
	}
	async function commitQuantity() {
		if (!canStack || savingQuantity) return;
		const value = quantity.trim() === "" ? Number.NaN : Number(quantity);
		if (value === committedQuantity) return;
		savingQuantity = true;
		try {
			await update("stack", value);
		} finally {
			// Rejected or interrupted text returns to the committed value; typing
			// itself does not enter history, and Enter followed by blur is one edit.
			quantity =
				committedQuantity === undefined ? "" : String(committedQuantity);
			savingQuantity = false;
		}
	}
</script>

<section aria-label="Selected backpack item" class="inspector">
	<header>
		<div class="large-icon"><BackpackItemVisual raw={item.raw} /></div>
		<div>
			<h2>{name}</h2>
			<p class="slot-label">Slot {item.slot + 1}</p>
		</div>
	</header>
	{#if description}<p class="description">{description}</p>{/if}
	<div class="properties">
		{#if canStack}
			<label
				>Quantity
				<input
					type="number"
					step="1"
					value={quantity}
					disabled={savingQuantity}
					oninput={(event) => {
						quantity = event.currentTarget.value;
					}}
					onblur={() => void commitQuantity()}
					onkeydown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							void commitQuantity();
						}
					}}
				/>
			</label>
		{:else if item.stack !== undefined}<p>Quantity: {item.stack}</p>{/if}
		{#if canQuality}
			<label
				>Quality
				<select
					value={item.quality}
					disabled={savingQuality}
					onchange={async (event) => {
						const control = event.currentTarget;
						savingQuality = true;
						try {
							await update("quality", Number(control.value));
						} finally {
							control.value = String(item.quality);
							savingQuality = false;
						}
					}}
				>
					{#if !qualities.some((quality) => quality.value === item.quality)}<option
							value={item.quality}>Custom ({item.quality})</option
						>{/if}
					{#each qualities as quality (quality.value)}<option
							value={quality.value}>{quality.label}</option
						>{/each}
				</select>
			</label>
		{:else if item.quality !== undefined}<p>Quality: {item.quality}</p>{/if}
	</div>
	{#if !canStack && !canQuality}<p>
			This item’s properties are preserved but cannot be edited here.
		</p>{/if}
	{#if error || guidance}<p role="status">{error || guidance}</p>{/if}
</section>

<style>
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
		margin-top: 24px;
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
		min-height: 44px;
		font: inherit;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		padding: 5px 8px;
	}
	[role="status"] {
		margin-top: 24px;
		font-size: 19px;
		color: #694621;
	}
</style>
