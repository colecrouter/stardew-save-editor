<script lang="ts">
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiField from "$lib/ui/UIField.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	let {
		disabled = false,
		pending = false,
		error = "",
		onclick,
	}: {
		disabled?: boolean;
		pending?: boolean;
		error?: string;
		onclick: () => void;
	} = $props();
</script>

<UiField label="Quantity" description="Whole items only" {error}>
	{#snippet children(field)}
		<UiInput
			id={field.id}
			aria-describedby={field.describedby}
			aria-invalid={field.invalid}
			type="number"
			value={2}
		/>
	{/snippet}
</UiField>
<UiButton
	variant="plain"
	aria-label="Apply quantity"
	{disabled}
	{pending}
	{onclick}>Apply</UiButton
>
<UiButton
	href="/farm"
	aria-label="Open farm"
	tabindex={0}
	{disabled}
	{pending}
	{onclick}>Farm</UiButton
>
