<script lang="ts">
	import type { ImmediateField } from "../../immediate-field.ts";
	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";

	let {
		field,
		description,
		list,
	}: { field: ImmediateField<number>; description?: string; list?: string } =
		$props();
	const id = $props.id();
	// The portable field owns domain meaning; the shared controller owns editing.
	// This component only binds native input and exposes its feedback accessibly.
	const editing = createImmediateFieldController(() => field);
	const describedBy = $derived(
		description || editing.error || field.reason ? `${id}-feedback` : undefined,
	);
</script>

<div class="editor-field">
	<label for={id}>{field.label}</label>

	<input
		{id}
		type="number"
		min={field.constraints?.min}
		max={field.constraints?.max}
		step={field.constraints?.step ?? 1}
		{list}
		disabled={!field.available}
		aria-invalid={editing.error ? "true" : undefined}
		aria-describedby={describedBy}
		bind:value={() => editing.value, (value) => editing.input(value)}
		onfocus={editing.focus}
		onblur={editing.blur}
	/>

	{#if editing.error || description || field.reason}
		<p
			id={`${id}-feedback`}
			class:error={!!editing.error}
			role={editing.error ? "status" : undefined}
		>
			{editing.error || field.reason || description}
		</p>
	{/if}
</div>

<style>
	@import "./field.css";
</style>
