<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { ImmediateField } from "../../immediate-field.ts";
	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";

	interface Props extends Omit<
		HTMLInputAttributes,
		"value" | "checked" | "type" | "children"
	> {
		field: ImmediateField<boolean>;
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
		...nativeProps
	}: Props = $props();
	// A toggle is one discrete action, even if keyboard focus stays on the box.
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

<div class="checkbox-field">
	<label>
		<input
			{...nativeProps}
			{id}
			type="checkbox"
			disabled={disabled || !field.available}
			aria-invalid={editing.error ? "true" : ariaInvalid}
			aria-describedby={describedBy}
			bind:checked={
				() => editing.value === true, (value) => editing.input(value)
			}
		/>

		<span>{field.label}</span>
	</label>

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
	.checkbox-field {
		min-width: 0;
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		cursor: pointer;
	}
	input {
		width: 20px;
		height: 20px;
		flex: none;
		accent-color: #246f44;
		cursor: inherit;
	}
	input:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 3px;
	}
	label:has(input:disabled) {
		color: #694621;
		cursor: default;
	}
	p {
		font-size: 17px;
		line-height: 1.25;
		color: #694621;
		margin: 0 0 4px 28px;
	}
	p.error {
		color: #8a1c19;
	}
</style>
