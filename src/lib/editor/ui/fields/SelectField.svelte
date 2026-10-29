<script lang="ts">
	import type { HTMLSelectAttributes } from "svelte/elements";
	import type { ImmediateField } from "../../immediate-field.ts";
	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";

	interface Props extends Omit<HTMLSelectAttributes, "value" | "children"> {
		field: ImmediateField<string>;
		description?: string;
		inline?: boolean;
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
		inline = false,
		onchange,
		...nativeProps
	}: Props = $props();
	const editing = createImmediateFieldController(() => field, {
		discrete: true,
	});
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

<div class="editor-field" class:inline>
	<label for={id}>{field.label}</label>

	<select
		{...nativeProps}
		{id}
		disabled={disabled || !field.available}
		value={editing.value}
		aria-invalid={editing.error ? "true" : ariaInvalid}
		aria-describedby={describedBy}
		onchange={(event) => {
			editing.input(event.currentTarget.value);
			onchange?.(event);
		}}
	>
		{#each field.options ?? [] as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>

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
	.inline {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 8px 10px;
	}
	.inline p {
		grid-column: 1 / -1;
	}
</style>
