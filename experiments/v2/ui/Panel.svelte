<script lang="ts">
	import { untrack } from "svelte";
	import NumberField from "./NumberField.svelte";
	import ReorderDialog from "./ReorderDialog.svelte";
	import type { InventoryModel } from "../inventory-model.ts";

	let { model }: { model: InventoryModel } = $props();
	// App keys the panel by session: these stores belong to this panel's lifetime.
	const { items, selected, money, count, canUndo, canRedo, error } = untrack(
		() => model,
	);
</script>

<section aria-label="Inventory editor">
	<label for="farmer">Farmer</label>
	<select
		id="farmer"
		onchange={(event) => model.chooseFarmer(event.currentTarget.value)}
	>
		<option value="host">Host</option><option value="guest">Guest</option>
	</select>
	<p>
		Money: <strong>{$money}</strong> · Applied actions:
		<strong data-testid="count">{$count}</strong>
	</p>
	<div class="slots" aria-label="Backpack slots">
		{#each $items as item (item.slot)}
			<button
				type="button"
				aria-pressed={$selected?.slot === item.slot}
				onclick={() => model.chooseSlot(item.slot)}
			>
				Slot {item.slot + 1}: {item.name}{item.stack ? ` × ${item.stack}` : ""}
			</button>
		{/each}
	</div>
	<h2>Selected: {$selected?.name ?? "None"}</h2>
	<NumberField field={model.stackField} />
	{#if !$selected?.editable}<p>
			This slot does not contain a supported stackable object.
		</p>{/if}
	<div class="actions">
		<button type="button" onclick={model.undo} disabled={!$canUndo}>Undo</button
		>
		<button type="button" onclick={model.redo} disabled={!$canRedo}>Redo</button
		>
	</div>
	<ReorderDialog commit={model.reverse} />
	{#if $error}<p role="alert">{$error}</p>{/if}
	<p role="status">
		{$canUndo
			? "Changes are recorded in transactional history."
			: "No actions to undo."}
	</p>
</section>

<style>
	section {
		padding: 20px;
		background: var(--editor-surface);
		border: 1px solid #ccd4ca;
		border-radius: 8px;
		margin-top: 24px;
	}
	label {
		display: block;
	}
	select {
		padding: 8px;
		max-width: 100%;
		box-sizing: border-box;
	}
	button[aria-pressed="true"] {
		background: var(--editor-selected);
		border-color: #335b35;
	}
	.slots,
	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.slots button {
		flex: 1 1 150px;
	}
</style>
