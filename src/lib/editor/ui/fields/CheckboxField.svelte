<script lang="ts">
	import type { ImmediateField } from "../../immediate-field.ts";
	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";

	let {
		field,
		description,
	}: { field: ImmediateField<boolean>; description?: string } = $props();
	const id = $props.id();
	// A toggle is one discrete action, even if keyboard focus stays on the box.
	const editing = createImmediateFieldController(() => field, {
		discrete: true,
	});
</script>

<div class="checkbox-field">
	<label>
		<input
			type="checkbox"
			disabled={!field.available}
			aria-invalid={editing.error ? "true" : undefined}
			aria-describedby={description || editing.error
				? `${id}-feedback`
				: undefined}
			bind:checked={
				() => editing.value === true, (value) => editing.input(value)
			}
		/>

		<span>{field.label}</span>
	</label>

	{#if editing.error || description}
		<p
			id={`${id}-feedback`}
			class:error={!!editing.error}
			role={editing.error ? "status" : undefined}
		>
			{editing.error || description}
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
