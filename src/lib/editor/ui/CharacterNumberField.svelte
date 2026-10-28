<script lang="ts">
	import { Result } from "effect";
	import type { CommandResult } from "../command-result.ts";

	let {
		label,
		value,
		min = 0,
		max,
		disabled = false,
		onchange,
	}: {
		label: string;
		value: number | undefined;
		min?: number;
		max?: number;
		disabled?: boolean;
		onchange: (
			value: number,
		) => Promise<undefined | CommandResult<unknown, { message: string }>>;
	} = $props();
	const id = $props.id();
	let error = $state("");
	let request = 0;
	let pending = $state<{ value: number; request: number }>();
	let cleared = $state<{ value: number | undefined }>();
	const visible = $derived(pending?.value ?? value);
	$effect(() => {
		// A blank is replacement text, not a missing saved value. External history
		// revisions restore the committed number without waiting for blur.
		if (cleared && !pending && value !== cleared.value) cleared = undefined;
	});
	function read() {
		return cleared ? undefined : visible;
	}
	async function write(next: number | null | undefined) {
		if (next == null) {
			cleared = { value: visible };
			error = "";
			return;
		}
		cleared = undefined;
		// Re-entering the committed value resolves a rejected edit too, even though
		// it needs no new history entry. Do not leave stale validation on that value.
		error = "";
		if (next === visible) return;
		// The command owns the shared request rules; native bounds provide a hint
		// while expected validation errors return through this same field boundary.
		const current = ++request;
		pending = { value: next, request: current };
		error = "";
		try {
			const result = await onchange(next);
			if (result && Result.isFailure(result) && pending?.request === current)
				error = result.failure.message;
		} finally {
			// A previous completion never replaces newer typing or disables focus.
			if (pending?.request === current) pending = undefined;
		}
	}
</script>

<div class="number-field">
	<label for={id}>{label}</label>

	<input
		{id}
		type="number"
		{min}
		{max}
		step="1"
		{disabled}
		aria-invalid={error ? "true" : undefined}
		aria-describedby={error ? `${id}-error` : undefined}
		bind:value={read, (next) => void write(next)}
	/>

	{#if error}
		<p id={`${id}-error`} role="status">{error}</p>
	{/if}
</div>

<style>
	.number-field {
		display: grid;
		align-content: start;
		gap: 6px;
		min-width: 0;
	}
	input {
		width: 100%;
		min-width: 0;
		min-height: 42px;
		padding: 5px 8px;
		font: inherit;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
	}
	input:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	input:disabled {
		opacity: 0.65;
	}
	p {
		margin: 0;
		color: #8a1c19;
		font-size: 17px;
	}
</style>
