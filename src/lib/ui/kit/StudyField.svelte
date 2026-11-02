<script lang="ts">
	import "./styles.css";
	import type { Snippet } from "svelte";
	interface ControlAttributes {
		id: string;
		"aria-describedby": string | undefined;
		"aria-invalid": true | undefined;
	}
	let {
		label,
		description,
		error,
		children,
	}: {
		label: string;
		description?: string;
		error?: string;
		children: Snippet<[ControlAttributes]>;
	} = $props();
	const id = $props.id();
	// The caller owns native value/events. Only labels and feedback associations
	// belong here; partial input, validation and Undo remain domain-field policies.
	const describedBy = $derived(
		[
			description ? `${id}-description` : undefined,
			error ? `${id}-error` : undefined,
		]
			.filter(Boolean)
			.join(" ") || undefined,
	);
</script>

<div class="study-kit study-field">
	<label for={id}>{label}</label>

	{@render children({
		id,
		"aria-describedby": describedBy,
		"aria-invalid": error ? true : undefined,
	})}

	{#if description}
		<p class="study-field-note" id={`${id}-description`}>{description}</p>
	{/if}

	{#if error}
		<p class="study-field-error" role="status" id={`${id}-error`}>{error}</p>
	{/if}
</div>
