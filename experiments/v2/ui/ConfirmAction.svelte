<script lang="ts">
	interface Props {
		title: string;
		description: string;
		label: string;
		disabled?: boolean;
		prepare?: () => void;
		commit: () => Promise<unknown>;
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
		try {
			await commit();
			dialog?.close();
			// The caller can focus a replacement result when the original trigger is gone.
			oncomplete();
		} catch (cause) {
			error = String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<button
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
		<button type="button" disabled={busy} onclick={() => dialog.close()}>
			Cancel
		</button>
		<button type="submit" disabled={busy}>
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
