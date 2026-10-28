<script lang="ts">
	import { Result } from "effect";
	import type { EditorModel } from "../editor-model.ts";
	import {
		setBackpackItem,
		decodeBackpackItemChange,
		type BackpackSlotView,
	} from "../inventory-operations.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import QualityBadge from "./QualityBadge.svelte";

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
	let error = $state("");
	const qualityGroup = $props.id();
	type Property = "stack" | "quality";
	let request = 0;
	let pending = $state<
		Partial<Record<Property, { value: number; request: number }>>
	>({});
	let clearedQuantity = $state<{ value: number | undefined }>();
	const committedQuantity = $derived(item.stack);
	// Clearing waits for replacement text, without changing the save. Remember
	// the latest in-flight value so its completion cannot refill the control;
	// a subsequent external revision (Undo/Redo) dismisses that empty input.
	$effect(() => {
		if (
			clearedQuantity &&
			!pending.stack &&
			committedQuantity !== clearedQuantity.value
		)
			clearedQuantity = undefined;
	});
	const guidance = $derived(
		canStack || canQuality
			? "Changes update immediately. Use Undo to revert."
			: "",
	);
	// Svelte does not accept function-pair bindings for bind:group. An accessor
	// gives the native radio group the same read/write boundary as the number input.
	const qualityBinding = {
		get value() {
			return pending.quality?.value ?? item.quality;
		},
		set value(value: number | undefined) {
			if (canQuality && value !== qualityBinding.value && value !== undefined)
				void update("quality", value);
		},
	};
	function readQuantity() {
		return clearedQuantity
			? undefined
			: (pending.stack?.value ?? committedQuantity);
	}
	function writeQuantity(value: number | null | undefined) {
		if (!canStack) return;
		if (value == null) {
			// Clearing the control lets someone replace the number without exporting
			// an absent quantity or adding an undo action for incomplete input.
			clearedQuantity = { value: pending.stack?.value ?? committedQuantity };
			error = "";
			return;
		}
		clearedQuantity = undefined;
		if (value !== readQuantity()) void update("stack", value);
	}
	const qualities = [
		{ value: 0, label: "Normal" },
		{ value: 1, label: "Silver" },
		{ value: 2, label: "Gold" },
		{ value: 4, label: "Iridium" },
	];

	async function update(property: Property, value: number) {
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
		// Valid input writes through immediately. Keep the latest requested value
		// visible while the shared command queue serializes rapid keystrokes; an
		// earlier completion must not replace a more recent input or steal focus.
		const currentRequest = ++request;
		pending[property] = { value, request: currentRequest };
		try {
			const result = await model.commands.transact(
				setBackpackItem(decoded.success),
			);
			if (
				result &&
				Result.isFailure(result) &&
				pending[property]?.request === currentRequest
			)
				error = result.failure.message;
			// Defects/cancellation remain with the shared session/toast boundary.
		} finally {
			// Completion exposes the committed projection again. A rejected write
			// therefore rolls back the bound control without manipulating the DOM.
			if (pending[property]?.request === currentRequest)
				delete pending[property];
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
					bind:value={readQuantity, writeQuantity}
				/>
			</label>
		{:else if item.stack !== undefined}<p>Quantity: {item.stack}</p>{/if}
		{#if canQuality}
			<!-- Binding the group preserves native focus and arrow-key selection while
			     each valid choice enters the same serialized command queue. -->
			<fieldset
				aria-busy={pending.quality !== undefined}
				class="quality-picker"
			>
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
								bind:group={qualityBinding.value}
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
			</fieldset>
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
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
		margin-top: 24px;
	}
	label {
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	input[type="number"] {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		font: inherit;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		padding: 5px 8px;
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

	[role="status"] {
		margin-top: 24px;
		font-size: 19px;
		color: #694621;
	}
</style>
