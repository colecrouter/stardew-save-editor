<script lang="ts">
	import { Result } from "effect";
	import type { CommandResult } from "../command-result.ts";
	interface Props {
		title: string;
		description: string;
		label: string;
		disabled?: boolean;
		prepare?: () => void;
		commit: () => Promise<CommandResult<unknown, { message: string }>>;
		oncomplete?: () => void;
	}
	let {
		title,
		description,
		label,
		disabled = false,
		prepare = () => {},
		commit,
		oncomplete = () => {},
	}: Props = $props();
	// Each mounted dialog has its own label/description IDs. Native modal behavior
	// provides focus containment and Escape cancellation without custom key handling.
	const id = $props.id();
	let dialog: HTMLDialogElement;
	let busy = $state(false);
	let error = $state("");
	// Keep validation failures inside the dialog for correction/retry. Success may
	// remove this component, so its bound element can already be cleared on return.
	async function confirm(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = "";
		const result = await commit();
		busy = false;
		// Noncompletion is handled globally. Keep the dialog open for retry.
		if (!result) return;
		if (Result.isFailure(result)) {
			error = result.failure.message;
			return;
		}
		dialog?.close();
		oncomplete();
	}
</script>

<button
	class="ui-control ui-button"
	type="button"
	{disabled}
	onclick={() => {
		prepare();
		error = "";
		dialog.showModal();
	}}
>
	{label}
</button>
<dialog
	bind:this={dialog}
	aria-labelledby={`${id}-title`}
	aria-describedby={`${id}-description`}
	oncancel={(event) => {
		if (busy) event.preventDefault();
	}}
>
	<h2 id={`${id}-title`}>{title}</h2>
	<p id={`${id}-description`}>{description}</p>
	{#if error}
		<p role="alert">{error}</p>
	{/if}
	<form onsubmit={confirm}>
		<button
			class="ui-control ui-button"
			type="button"
			disabled={busy}
			onclick={() => dialog.close()}
		>
			Cancel
		</button>
		<button class="ui-control ui-button" type="submit" disabled={busy}>
			{busy ? "Applying..." : label}
		</button>
	</form>
</dialog>

<style>
	dialog {
		max-width: min(440px, calc(100vw - 32px));
		box-sizing: border-box;
		border: 3px solid #70401d;
		border-radius: 8px;
		padding: 24px;
		background: #ffe2aa;
		color: #351b0e;
		font: inherit;
	}
	dialog::backdrop {
		background: #102016aa;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		justify-content: flex-end;
	}
	button {
		font: inherit;
		min-height: 44px;
		padding: 6px 12px;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	[role="alert"] {
		color: #8a1c19;
		overflow-wrap: anywhere;
	}
</style>
