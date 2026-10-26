<script lang="ts">
	import "./controls.css";
	import * as Sentry from "@sentry/sveltekit";
	import type { HTMLInputAttributes } from "svelte/elements";

	type Props = Omit<HTMLInputAttributes, "value"> & {
		value: string | number;
	};

	let { value = $bindable(), class: className, ...props }: Props = $props();
	let defaultValue = $derived(
		props.defaultValue ?? (props.type === "number" ? (props.min ?? 0) : ""),
	);

	let input: HTMLInputElement | undefined;
	let isEmpty = $state(value === null);
	// Text that is still invalid while typing (e.g. "2" on the way to "25" when min is 23).
	// Returned by the getter so the input isn't reset to the old value mid-edit.
	let pendingText = $state<string | number | null>(null);

	function reportUnexpectedSymbol(context: string) {
		Sentry.logger.error("Unexpected Symbol in UIInput value", {
			context,
			type: props.type ?? null,
			name: props.name ?? null,
			testid: props["data-testid"] ?? null,
		});
	}

	function getter() {
		// Checked first: after clearing the input, the next keystroke may still be invalid
		if (pendingText !== null) return pendingText;
		if (isEmpty) return "";
		if (typeof value === "symbol") {
			reportUnexpectedSymbol("getter");
			return "";
		}
		return value;
	}

	function setter(v: typeof value) {
		if (typeof v === "symbol") {
			reportUnexpectedSymbol("setter");
			return;
		}

		// Reset custom validity
		input?.setCustomValidity("");

		// Preemptive check for native validation
		input?.reportValidity();
		if (!input?.checkValidity()) {
			pendingText = v;
			return;
		}
		pendingText = null;

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
		if (!input) return;

		// Drop unfinished invalid text and show the stored value again
		if (pendingText !== null) {
			pendingText = null;
			input.setCustomValidity("");
			input.value = value === null || value === undefined ? "" : String(value);
			if (input.value) isEmpty = false;
		}

		// If the input is empty, reset the value to the default value
		if (!input.value || isEmpty) {
			setter(defaultValue);
		}
	}
</script>

<input
	bind:this={input}
	bind:value={getter, setter}
	{onblur}
	{...props}
	class={["ui-control", className]}
/>

<style>
	input:focus-visible {
		outline: 3px solid var(--ui-focus);
		outline-offset: 3px;
	}

	/* Safari otherwise draws search boxes with its own rounded style */
	input[type="search"] {
		appearance: textfield;
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
