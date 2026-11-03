<script lang="ts">
	import type { ImmediateField } from "../../immediate-field.ts";
	import { onDestroy, untrack } from "svelte";
	import { Result } from "effect";
	import NumberField from "./NumberField.svelte";
	import StudyButton from "../../../ui/kit/StudyButton.svelte";

	let {
		field,
		description,
	}: {
		field: ImmediateField<number>;
		description?: string;
	} = $props();
	const id = $props.id();
	const feedbackId = `${id}-step-feedback`;
	let row: HTMLDivElement;
	// Typing keeps NumberField's focus gesture. Each arrow is instead a complete
	// decision that opens and closes one Undo group for each accepted click.
	let pending = $state(false);
	let error = $state("");
	let request = 0;
	let key = untrack(() => field.key);
	let scope = untrack(() => field.scope);
	let committed = untrack(() => field.value);
	$effect(() => {
		// Later owner/field descriptors cannot inherit an earlier arrow's feedback.
		if (field.key !== key || field.scope !== scope) {
			key = field.key;
			scope = field.scope;
			request++;
			pending = false;
			error = "";
		}
		if (field.value !== committed) error = "";
		committed = field.value;
	});
	onDestroy(() => {
		request++;
	});
	const step = $derived(
		typeof field.constraints?.step === "number" && field.constraints.step > 0
			? field.constraints.step
			: 1,
	);
	function candidate(value: number | undefined, direction: -1 | 1) {
		if (value === undefined || !Number.isFinite(value)) return undefined;
		const next = value + direction * step;
		return Number.isFinite(next) &&
			(field.constraints?.min === undefined || next >= field.constraints.min) &&
			(field.constraints?.max === undefined || next <= field.constraints.max)
			? next
			: undefined;
	}
	async function move(direction: -1 | 1) {
		if (!field.available || pending) return;
		// A typed edit can still be queued when the pointer reaches an arrow.
		// Start from the visible valid number, not an older published descriptor.
		// Blank/invalid imported or replacement text never becomes an implicit zero.
		const input = row.querySelector("input");
		if (!input || !input.validity.valid || input.value === "") return;
		const next = candidate(input.valueAsNumber, direction);
		if (next === undefined) return;
		const captured = field;
		const gesture = captured.begin();
		const current = ++request;
		pending = true;
		error = "";
		try {
			// Submit before ending so the file queue closes this arrow's own group.
			// Do not compare next with a stale descriptor: typing may already have
			// queued a different value, and this click must still restore next.
			const completion = captured.commit(next, gesture);
			const ending = captured.end(gesture);
			const result = await completion;
			await ending;
			if (current === request && result && Result.isFailure(result))
				error = result.failure.message;
		} finally {
			if (current === request) pending = false;
		}
	}
</script>

<div class="stepper" bind:this={row}>
	<StudyButton
		iconOnly
		aria-label={`Previous ${field.label}`}
		disabled={!field.available ||
			pending ||
			candidate(field.value, -1) === undefined}
		onclick={() => void move(-1)}
	>
		<span aria-hidden="true">←</span>
	</StudyButton>

	<NumberField
		{field}
		{description}
		disabled={pending}
		aria-describedby={error ? feedbackId : undefined}
	/>

	<StudyButton
		iconOnly
		aria-label={`Next ${field.label}`}
		disabled={!field.available ||
			pending ||
			candidate(field.value, 1) === undefined}
		onclick={() => void move(1)}
	>
		<span aria-hidden="true">→</span>
	</StudyButton>
</div>

{#if error}
	<p id={feedbackId} class="error" role="status">{error}</p>
{/if}

<style>
	.stepper {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) 44px;
		gap: 8px;
		align-items: start;
		min-width: 0;
	}
	/* Short appearance labels occupy the first text line. Align the browse
	   actions with the native control, independently of any feedback below it. */
	.stepper > :global(button) {
		margin-top: 30px;
	}
	.error {
		margin: 6px 0 0;
		color: #8a1c19;
		font-size: 17px;
	}
</style>
