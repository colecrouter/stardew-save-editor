<script lang="ts">
	import type { ImmediateField } from "../../immediate-field.ts";
	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";

	let {
		field,
		description,
		sensitive = false,
	}: {
		field: ImmediateField<string>;
		description?: string;
		sensitive?: boolean;
	} = $props();
	const id = $props.id();
	// Focus/blur delimit Undo gestures; valid text is already applied as it changes.
	const editing = createImmediateFieldController(() => field);
</script>

<div class="editor-field">
	<label for={id}>{field.label}</label>

	<input
		{id}
		type="text"
		required={field.constraints?.required}
		disabled={!field.available}
		data-sentry-mask={sensitive ? "" : undefined}
		aria-invalid={editing.error ? "true" : undefined}
		aria-describedby={description || editing.error || field.reason
			? `${id}-feedback`
			: undefined}
		bind:value={() => editing.value ?? "", (value) => editing.input(value)}
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
