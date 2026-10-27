<script lang="ts">
	import { onDestroy } from "svelte";
	import { openEditor } from "../editor-model.ts";
	import EditorWorkspace from "./EditorWorkspace.svelte";
	import "../../../src/lib/ui/study-theme.css";
	let active = $state.raw<Awaited<ReturnType<typeof openEditor>>>();
	let filename = $state("");
	let opening = $state(false);
	let error = $state("");
	// File reads cannot be canceled reliably. A generation token prevents an older
	// import from installing its session after replacement, cancellation or unmount.
	let generation = 0;
	// Own at most one browser export URL, and release it on replacement/close.
	// Downloading does not transfer responsibility for revoking this URL.
	let downloadUrl: string | undefined;
	function releaseUrl() {
		if (downloadUrl) {
			URL.revokeObjectURL(downloadUrl);
			downloadUrl = undefined;
		}
	}
	// Remove the workspace before closing its resources. Any UI handles retained
	// during teardown then see a closed model instead of an abandoned live save.
	async function close() {
		generation++;
		const previous = active;
		active = undefined;
		opening = false;
		releaseUrl();
		await previous?.close();
	}
	// Replacement releases the previous file before acquiring the next one.
	// If the result is stale, close the newly acquired session immediately.
	async function load(file: File) {
		const token = ++generation;
		opening = true;
		error = "";
		const previous = active;
		active = undefined;
		releaseUrl();
		await previous?.close();
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			if (token !== generation) return;
			const opened = await openEditor(bytes);
			if (token !== generation) {
				await opened.close();
				return;
			}
			active = opened;
			filename = file.name;
		} catch (cause) {
			if (token === generation) error = String(cause);
		} finally {
			if (token === generation) opening = false;
		}
	}
	// Export is queued with edits by the model. A file closed/replaced while that
	// work runs must not trigger a download for the wrong active workspace.
	async function download() {
		const current = active;
		if (!current) return;
		const bytes = await current.model.export();
		if (active !== current) return;
		releaseUrl();
		downloadUrl = URL.createObjectURL(
			new Blob([Uint8Array.from(bytes)], { type: "application/xml" }),
		);
		const anchor = document.createElement("a");
		anchor.href = downloadUrl;
		anchor.download = filename;
		anchor.click();
	}
	onDestroy(() => {
		generation++;
		releaseUrl();
		void active?.close();
	});
</script>

<main>
	{#if active}
		{#key active}
			<EditorWorkspace
				model={active.model}
				{filename}
				onclose={() => void close()}
				ondownload={download}
			/>{/key}
	{:else}
		<section class="upload study-theme">
			<h1>V2 editing workspace</h1>
			<p>
				Open a Stardew Valley 1.6 save to edit its date and weather, review
				changes, and undo before exporting.
			</p>
			<label>
				Save file
				<input
					type="file"
					disabled={opening}
					onchange={(event) => {
						const file = event.currentTarget.files?.[0];
						if (file) void load(file);
					}}
				/>
			</label>
			{#if opening}
				<p role="status">Opening save…</p>
				<button type="button" onclick={() => void close()}>
					Cancel import
				</button>
			{/if}
			{#if error}
				<p role="alert">{error}</p>
			{/if}
		</section>
	{/if}
</main>

<style>
	main {
		padding: 8px;
	}
	.upload {
		max-width: 700px;
		margin: 40px auto;
		padding: 24px;
		background: #ffe2aa;
		border-radius: 8px;
	}
	.upload label {
		display: grid;
		gap: 12px;
	}
	.upload input {
		font: inherit;
		max-width: 100%;
	}
	button {
		font: inherit;
		min-height: 44px;
	}
	[role="alert"] {
		color: #8a1c19;
	}
</style>
