<script lang="ts">
	import { untrack } from "svelte";
	import type { InventoryModel } from "../inventory-model.ts";

	let { model }: { model: InventoryModel } = $props();
	// App keys the panel by session: these stores belong to this panel's lifetime.
	const { items, selected, money, count, canUndo, canRedo, error } = untrack(
		() => model,
	);
	function commit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		model.stack.set(Number(new FormData(form).get("stack")));
	}
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
	<form onsubmit={commit}>
		<label for="stack">Stack size</label>
		<input
			id="stack"
			name="stack"
			type="number"
			min="1"
			max="999"
			step="1"
			required
			value={$selected?.stack || 1}
			disabled={!$selected?.editable}
		/>
		<button type="submit" disabled={!$selected?.editable}>Apply stack</button>
	</form>
	{#if !$selected?.editable}<p>
			This slot does not contain a supported stackable object.
		</p>{/if}
	<div class="actions">
		<button type="button" onclick={model.undo} disabled={!$canUndo}>Undo</button
		>
		<button type="button" onclick={model.redo} disabled={!$canRedo}>Redo</button
		>
		<button type="button" onclick={model.reverse}>Reverse backpack</button>
	</div>
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
		background: white;
		border: 1px solid #ccd4ca;
		border-radius: 8px;
		margin-top: 24px;
	}
	label {
		display: block;
	}
	select,
	input {
		padding: 8px;
		max-width: 100%;
		box-sizing: border-box;
	}
	button {
		padding: 8px 12px;
		cursor: pointer;
		border: 1px solid #738575;
		background: #f5f8f3;
		border-radius: 4px;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	button[aria-pressed="true"] {
		background: #dcebd8;
		border-color: #335b35;
	}
	.slots,
	.actions,
	form {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.slots button {
		flex: 1 1 150px;
	}
	form {
		align-items: end;
	}
	form label {
		flex-basis: 100%;
	}
	input {
		width: 130px;
	}
	.actions {
		margin-top: 20px;
	}
	h2 {
		font-size: 1.15rem;
		margin-top: 24px;
	}
	[role="alert"] {
		color: #912b22;
	}
</style>
