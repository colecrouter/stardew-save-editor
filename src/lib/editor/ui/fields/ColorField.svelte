<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";

	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";
	import type { ImmediateField } from "../../immediate-field.ts";

	interface Props extends Omit<
		HTMLInputAttributes,
		"value" | "checked" | "type" | "children"
	> {
		field: ImmediateField<string>;
		// An unavailable domain hint clears the supplemental feedback text.
		description?: string | undefined;
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

		required = false,
		...nativeProps
	}: Props = $props();
	// Focus/blur delimit Undo gestures; valid text is already applied as it changes.
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
		type="color"
		required={required || field.constraints?.required}
		disabled={disabled || !field.available}
		aria-invalid={editing.error ? "true" : ariaInvalid}
		aria-describedby={describedBy}
		value={editing.value ?? "#000000"}
		oninput={(event) => {
			editing.input(event.currentTarget.value);
			nativeProps.oninput?.(event);
		}}
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
	input {
		width: 100%;
		min-height: 48px;
		padding: 4px;
		cursor: pointer;
	}
</style>
