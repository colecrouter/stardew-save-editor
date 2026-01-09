<script lang="ts">
import type { HTMLInputAttributes } from "svelte/elements";

type Props = Omit<HTMLInputAttributes, "value"> & {
	value: string | number;
};

let { value = $bindable(), ...props }: Props = $props();
let defaultValue = $derived(
	props.defaultValue ?? (props.type === "number" ? (props.min ?? 0) : ""),
);

let input: HTMLInputElement | undefined;
let isEmpty = $state(value === null);

function getter() {
	if (isEmpty) return "";
	return value;
}

function setter(v: typeof value) {
	// Reset custom validity
	input?.setCustomValidity("");

	// Preemptive check for native validation
	input?.reportValidity();
	if (!input?.checkValidity()) {
		return;
	}

	// Update the isEmpty state
	// This causes the getter to not to return the previous value when the input is empty
	if (v === null) {
		isEmpty = true;
	} else {
		isEmpty = false;
	}

	// Try to set the value, then show any errors as a custom validity
	try {
		value = v;
	} catch (error) {
		if (!(error instanceof Error)) throw error;
		// Set the input text to the current value, anyway
		input.value = v === null ? defaultValue.toString() : v.toString();
		input.setCustomValidity(error.message);
	}

	input.reportValidity();
}

function onblur() {
	// If the input is empty, reset the value to the default value
	const v = input?.value;
	if (!v) {
		setter(defaultValue);
	}
}
</script>

<input bind:this={input} bind:value={getter, setter} {onblur} {...props} />

<style>
	input[type="text"],
	input[type="number"] {
		border-radius: 4px;
		border: solid 2px;
		border-bottom-color: #9c613b;
		border-left-color: #9c613b;
		border-right-color: #6f3b31;
		border-top-color: #6f3b31;
		background-color: #f9bb65;
		box-shadow:
			inset -2px 2px 0 #e38813,
			-2px 2px 1px rgba(0, 0, 0, 0.2);
	}

	input[type="text"]:disabled,
	input[type="number"]:disabled {
		background-color: #de9a3c;
		color: #000;
	}

	input[type="text"]:focus,
	input[type="number"]:focus {
		outline: none;
	}

	input:invalid {
		box-shadow: red 0 0 0 2px;
	}

	input[type="number"] {
		width: 4em;
		text-align: right;
	}

	input[type="number"]::-webkit-inner-spin-button {
		appearance: none;
	}
</style>
