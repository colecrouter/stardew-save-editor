<script lang="ts">
	let { commit }: { commit: () => void } = $props();
	let implementation = $state("native");
	let nativeDialog = $state<HTMLDialogElement>();
	const bitsModule = $derived(
		implementation === "bits"
			? import("./BitsReorderDialog.svelte")
			: undefined,
	);
</script>

<label for="dialog-implementation">Confirmation implementation</label>
<select id="dialog-implementation" bind:value={implementation}>
	<option value="native">Native dialog</option>
	<option value="bits">Bits UI dialog</option>
</select>
{#if implementation === "native"}
	<button type="button" onclick={() => nativeDialog?.showModal()}
		>Reverse backpack…</button
	>
	<dialog
		bind:this={nativeDialog}
		aria-labelledby="native-title"
		aria-describedby="native-description"
	>
		<h2 id="native-title">Reverse backpack?</h2>
		<p id="native-description">
			Every slot moves, including empty slots. You can undo this action.
		</p>
		<form method="dialog">
			<button type="submit">Cancel</button>
			<button type="submit" onclick={commit}>Reverse slots</button>
		</form>
	</dialog>
{:else}
	{#if bitsModule}
		{#await bitsModule}<p role="status">Loading dialog?</p>
		{:then module}<module.default {commit} />
		{:catch}<p role="alert">
				The dialog could not load. Choose the native dialog to continue.
			</p>{/await}
	{/if}
{/if}

<style>
	label {
		display: block;
		margin-top: 16px;
	}
	select,
	button {
		padding: 8px 12px;
		margin: 4px;
	}
	dialog,
	:global(.dialog-content) {
		box-sizing: border-box;
		width: min(460px, calc(100vw - 32px));
		padding: 24px;
		border: 1px solid var(--editor-border);
		border-radius: 8px;
		background: var(--editor-surface);
		color: var(--editor-text);
	}
	:global(.dialog-content) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 11;
	}
	dialog::backdrop,
	:global(.dialog-overlay) {
		background: #10201688;
	}
	:global(.dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: 10;
	}
</style>
