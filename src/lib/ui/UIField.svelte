<script lang="ts">
	import type { Snippet } from "svelte";
	import "./controls.css";
	interface FieldAttributes {
		id: string;
		describedby: string | undefined;
		invalid: true | undefined;
	}
	let {
		label,
		description = "",
		error = "",
		children,
	}: {
		label: string;
		description?: string;
		error?: string;
		children: Snippet<[FieldAttributes]>;
	} = $props();
	const id = $props.id();
	const describedby = $derived(
		[description ? `${id}-description` : "", error ? `${id}-error` : ""]
			.filter(Boolean)
			.join(" ") || undefined,
	);
</script>

<div class="ui-field">
	<label for={id}>{label}</label>
	<div class="control">
		{@render children({ id, describedby, invalid: error ? true : undefined })}
	</div>
	{#if description}<small id={`${id}-description`}>{description}</small>{/if}
	{#if error}<small id={`${id}-error`} class="error" role="alert">{error}</small
		>{/if}
</div>

<style>
	.ui-field {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 14rem);
		align-items: center;
		gap: 6px 8px;
		margin-block: 8px;
	}
	.control {
		min-width: 0;
	}
	small {
		grid-column: 1 / -1;
		font-size: 0.8rem;
		font-weight: normal;
	}
	.error {
		color: var(--ui-error);
	}
	@media (max-width: 480px) {
		.ui-field {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
