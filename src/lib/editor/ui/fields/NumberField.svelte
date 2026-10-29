<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { ImmediateField } from "../../immediate-field.ts";
	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";

	interface Props extends Omit<
		HTMLInputAttributes,
		"value" | "checked" | "type" | "children"
	> {
		field: ImmediateField<number>;
		description?: string;
	}
	const generatedId = $props.id();
	// Native attributes belong to the control. Value and editor lifecycle remain
	// field-owned; compose caller handlers rather than replacing that lifecycle.
	let {
		field,
		description,
		id = generatedId,
		disabled = false,
		"aria-describedby": ariaDescribedBy,
		"aria-invalid": ariaInvalid,
		onfocus,
		onblur,
		min,
		max,
		step,
		...nativeProps
	}: Props = $props();
	// The portable field owns domain meaning; the shared controller owns editing.
	// This component only binds native input and exposes its feedback accessibly.
	const editing = createImmediateFieldController(() => field);
	const describedBy = $derived(
		[
			ariaDescribedBy,
			editing.error || description || field.reason
				? `${id}-feedback`
				: undefined,
		]
			.filter(Boolean)
			.join(" ") || undefined,
	);
</script>

<div class="editor-field">
	<label for={id}>{field.label}</label>

	<input
		{...nativeProps}
		{id}
		type="number"
		min={min ?? field.constraints?.min}
		max={max ?? field.constraints?.max}
		step={step ?? field.constraints?.step ?? 1}
		disabled={disabled || !field.available}
		aria-invalid={editing.error ? "true" : ariaInvalid}
		aria-describedby={describedBy}
		bind:value={() => editing.value, (value) => editing.input(value)}
		onfocus={(event) => {
			editing.focus();
			onfocus?.(event);
		}}
		onblur={(event) => {
			editing.blur();
			onblur?.(event);
		}}
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
