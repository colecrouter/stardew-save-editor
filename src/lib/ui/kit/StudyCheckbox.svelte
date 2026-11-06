<script lang="ts">
	import "./styles.css";
	import type { HTMLInputAttributes } from "svelte/elements";
	interface Props extends Omit<
		HTMLInputAttributes,
		"type" | "checked" | "children"
	> {
		checked?: boolean;
		label: string;
		description?: string;
	}
	const generatedId = $props.id();
	let {
		checked = $bindable(false),
		label,
		description,
		id = generatedId,
		"aria-describedby": describedBy,
		...native
	}: Props = $props();
</script>

<div class="study-kit">
	<!-- Keep the real checkbox for Space, forms and assistive technology. Native
	     change/input handlers are forwarded; this primitive has no commit policy. -->
	<label class="study-checkbox-label" for={id}>
		<input
			{...native}
			{id}
			type="checkbox"
			bind:checked
			aria-describedby={[
				describedBy,
				description ? `${id}-description` : undefined,
			]
				.filter(Boolean)
				.join(" ") || undefined}
		/>

		<span>{label}</span>
	</label>

	{#if description}
		<p class="study-field-note" id={`${id}-description`}>{description}</p>
	{/if}
</div>
