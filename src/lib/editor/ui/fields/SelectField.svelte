<script lang="ts">
	import type { ImmediateField } from "../../immediate-field.ts";
	import { createImmediateFieldController } from "../../immediate-field.svelte.ts";

	let {
		field,
		description,
		inline = false,
	}: {
		field: ImmediateField<string>;
		description?: string;
		inline?: boolean;
	} = $props();
	const id = $props.id();
	const editing = createImmediateFieldController(() => field, {
		discrete: true,
	});
</script>

<div class="editor-field" class:inline>
	<label for={id}>{field.label}</label>

	<select
		{id}
		disabled={!field.available}
		value={editing.value}
		aria-invalid={editing.error ? "true" : undefined}
		aria-describedby={editing.error || description || field.reason
			? `${id}-feedback`
			: undefined}
		onchange={(event) => editing.input(event.currentTarget.value)}
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
