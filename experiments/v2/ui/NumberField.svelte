<script lang="ts">
	import { untrack } from "svelte";
	import { createDraft, type NumericField } from "../field.ts";
	let { field }: { field: NumericField } = $props();
	// The parent keys this editing interaction when it replaces the field itself.
	const draft = createDraft(untrack(() => field));
	const uid = $props.id();
</script>

<form
	onsubmit={(event) => {
		event.preventDefault();
		void draft.submit();
	}}
>
	<label for={uid}>{field.label}</label>
	<p id={`${uid}-description`}>{field.description}</p>
	<div class="controls">
		<input
			id={uid}
			type="number"
			min={field.constraints.min}
			max={field.constraints.max}
			step={field.constraints.step}
			required
			value={$draft.text}
			oninput={(event) => draft.input(event.currentTarget.value)}
			aria-describedby={`${uid}-description ${uid}-feedback`}
			aria-invalid={$draft.error ? true : undefined}
			disabled={!$draft.base.available || $draft.pending}
		/>
		<button
			type="submit"
			disabled={!$draft.dirty ||
				$draft.conflict ||
				!$draft.base.available ||
				$draft.pending}
		>
			{field.actionLabel}
		</button>
		<button
			type="button"
			onclick={draft.reload}
			disabled={$draft.pending || (!$draft.dirty && !$draft.conflict)}
		>
			Reload current value
		</button>
	</div>
	<p id={`${uid}-feedback`} role="status">
		{#if $draft.error}
			{$draft.error}
		{:else if $draft.conflict}
			The save or selection changed. Your draft is kept; reload to edit the
			current selection.
		{:else if $draft.pending}
			Applying change…
		{:else if $draft.dirty}
			Unapplied draft.
		{:else}
			Current saved value.{/if}
	</p>
</form>

<style>
	form {
		margin-block: 16px;
	}
	label {
		display: block;
		font-weight: 600;
	}
	p {
		margin-block: 6px;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	input {
		width: 110px;
		padding: 8px;
	}
	button {
		padding: 8px 12px;
	}
</style>
