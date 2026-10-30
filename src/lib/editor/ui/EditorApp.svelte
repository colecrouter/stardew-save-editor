<script lang="ts">
	import { Result } from "effect";
	import { downloadSave } from "../../downloadSave.ts";
	import { onDestroy, tick } from "svelte";
	import { RegistryProvider } from "effect-atom-svelte";
	import { SaveReadError, describeImportError } from "../save-service.ts";
	import { openEditor } from "../editor-model.ts";
	import EditorWorkspace from "./EditorWorkspace.svelte";
	import BackupPanel from "./BackupPanel.svelte";
	import "../../ui/study-theme.css";
	interface Props {
		includeProofs?: boolean;
		legacyHref?: string;
		backupOriginal?: (file: File) => Promise<void>;
	}
	let { includeProofs = false, legacyHref, backupOriginal }: Props = $props();
	let active = $state.raw<Awaited<ReturnType<typeof openEditor>>>();
	let filename = $state("");
	let opening = $state(false);
	let error = $state("");
	let downloadError = $state("");
	let downloading = $state(false);
	let backupsOpen = $state(false);
	// File reads cannot be canceled reliably. A generation token prevents an older
	// import from installing its session after replacement, cancellation or unmount.
	let generation = 0;
	// A closing screen cancels a pending picker/export. Download URLs have their
	// own bounded timer so a just-started Safari stream is not revoked on close.
	let downloadController = new AbortController();
	// All release paths detach consumers before disposing their borrowed registry.
	// Keeping this ordering in one helper avoids drift between close/replacement.
	async function detach() {
		const previous = active;
		active = undefined;
		downloadController.abort();
		downloadController = new AbortController();
		await tick();
		await previous?.close();
	}
	async function close() {
		generation++;
		opening = false;
		downloading = false;
		error = "";
		downloadError = "";
		await detach();
	}
	// Replacement releases the previous file before acquiring the next one.
	// If the result is stale, close the newly acquired session immediately.
	async function load(file: File, saveBackup = true) {
		const token = ++generation;
		opening = true;
		error = "";
		downloadError = "";
		await detach();
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			if (token !== generation) return;
			const opened = await openEditor(bytes, {}, { includeProofs });
			if (token !== generation) {
				await opened.close();
				return;
			}
			active = opened;
			filename = file.name;
			// Back up only a successfully decoded import. Failure must not block
			// editing; retain the original selected file and surface the warning.
			try {
				if (saveBackup) await backupOriginal?.(file);
			} catch {
				if (token === generation)
					error =
						"The original file could not be backed up. Keep a separate copy before exporting.";
			}
		} catch (cause) {
			if (token === generation) {
				if (cause instanceof SaveReadError) error = describeImportError(cause);
				else {
					console.error("Save import failed", cause);
					error = "The save could not be opened. Please try again.";
				}
			}
		} finally {
			if (token === generation) opening = false;
		}
	}
	// Export is queued with edits by the model. A file closed/replaced while that
	// work runs must not trigger a download for the wrong active workspace.
	async function download() {
		const current = active;
		if (!current || downloading) return;
		downloading = true;
		// A retry clears only download feedback, leaving backup warnings intact.
		downloadError = "";
		try {
			const result = await current.model.commands.export();
			if (!result || active !== current) return;
			if (Result.isFailure(result)) return result;
			await downloadSave(
				new Blob([Uint8Array.from(result.success)], {
					type: "application/octet-stream",
				}),
				filename,
				downloadController.signal,
			);
		} catch (cause) {
			// Browser file writes live at the application boundary. A failure
			// leaves the session/draft intact and permits an explicit retry.
			console.error("Save download failed", cause);
			if (active === current)
				downloadError = "The save could not be downloaded. Please try again.";
		} finally {
			// A previous session must not clear a replacement's pending state.
			if (active === current) downloading = false;
		}
	}

	onDestroy(() => {
		generation++;
		void detach();
	});
</script>

<div class="editor-application">
	{#if active}
		{#if error}
			<p role="alert">{error}</p>
		{/if}
		{#if downloadError}
			<p role="alert">{downloadError}</p>
		{/if}
		{#if active.model.loadValidation.errors.length || active.model.loadValidation.warnings.length}
			<details class="validation">
				<summary>Imported save has existing problems</summary>
				<ul>
					{#each [...active.model.loadValidation.errors, ...active.model.loadValidation.warnings] as problem}
						<li>
							{problem}
						</li>
					{/each}
				</ul>
				<p>
					Viewing does not change these fields. Export is blocked if definite
					errors remain.
				</p>
			</details>
		{/if}
		{#key active}
			<!-- A file replacement remounts the provider: it reads its registry
                 once. Passing our registry leaves disposal with the file scope. -->
			<RegistryProvider registry={active.model.atomBindings.registry}>
				<EditorWorkspace
					model={active.model}
					{includeProofs}
					{downloading}
					{filename}
					onclose={() => void close()}
					ondownload={download}
				/>
			</RegistryProvider>
		{/key}
	{:else}
		<section class="upload study-theme">
			<h1>V2 editing workspace</h1>
			<p>
				Open a Stardew Valley 1.6 save to edit your farm, characters, inventory,
				storage and progression. Review changes and undo before exporting.
			</p>
			<p>
				The workspace includes buildings and animals, relationships, appearance,
				recipes, quests, Community Center and Joja projects, and farmhand
				reassignment. Each editor opens its own file.
			</p>
			{#if legacyHref}
				<a href={legacyHref}>Open the legacy editor</a>
			{/if}
			<p>
				Keep a backup. Select the main farm save, not SaveGameInfo. Downloaded
				saves keep their original name without adding an extension.
			</p>
			<details>
				<summary>Finding and replacing your save</summary>
				<p>
					Windows: %AppData%\StardewValley\Saves. macOS: ~/Library/Application
					Support/StardewValley/Saves. Linux: ~/.config/StardewValley/Saves.
				</p>
				<p>
					On iOS, use Files → On My iPhone/iPad → Stardew Valley. Android save
					access depends on the device and game installation. Use your device’s
					file manager or connect it to a computer.
				</p>
				<p>
					After downloading, close Stardew Valley and copy the file back into
					the same save folder with its original name. Keep the original until
					you have loaded and checked the edited save in game.
				</p>
			</details>
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
			<details class="backups" bind:open={backupsOpen}>
				<summary>Original save backups</summary>
				{#if backupsOpen}
					<BackupPanel
						disabled={opening}
						onopen={(file) => load(file, false)}
					/>
				{/if}
			</details>

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
</div>

<style>
	.editor-application {
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
