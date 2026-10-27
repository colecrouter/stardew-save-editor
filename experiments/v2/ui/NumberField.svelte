<script lang="ts">
	import { createRuneDraft } from "../field.svelte.ts";
	import { type NumericField } from "../field.ts";
	let { field }: { field: NumericField } = $props();
	// Follow field replacements without applying a dirty draft to a new target.
	const draft = createRuneDraft(() => field);
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
			value={draft.current.text}
			oninput={(event) => draft.input(event.currentTarget.value)}
			aria-describedby={`${uid}-description ${uid}-feedback`}
			aria-invalid={draft.current.error ? true : undefined}
			disabled={!draft.current.base.available || draft.current.pending}
		/>
		<button
			type="submit"
			disabled={!draft.current.dirty ||
				draft.current.conflict ||
				!draft.current.base.available ||
				draft.current.pending}
		>
			{field.actionLabel}
		</button>
		<button
			type="button"
			onclick={draft.reload}
			disabled={draft.current.pending ||
				(!draft.current.dirty && !draft.current.conflict)}
		>
			Reload current value
		</button>
	</div>
	<p id={`${uid}-feedback`} role="status">
		{#if draft.current.error}
			{draft.current.error}
		{:else if draft.current.conflict}
			The save or selection changed. Your draft is kept; reload to edit the
			current selection.
		{:else if draft.current.pending}
			Applying change…
		{:else if draft.current.dirty}
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
