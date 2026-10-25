<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";

	type Props = Omit<HTMLInputAttributes, "value" | "checked"> & {
		checked: boolean;
	};

	let { checked = $bindable(), ...props }: Props = $props();
</script>

<input type="checkbox" bind:checked {...props} />

<style>
	input {
		appearance: auto;
		accent-color: var(--ui-focus, #2379ba);
		width: 24px;
		height: 24px;
		margin: 0;
		cursor: pointer;
		flex: none;
	}
	input:focus-visible {
		outline: 3px solid var(--ui-focus, #2379ba);
		outline-offset: 3px;
	}
	input:disabled {
		opacity: 0.65;
		cursor: default;
	}
</style>
