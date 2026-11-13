<script lang="ts">
	import { Result, type Layer } from "effect";
	import type { SaveProcessor } from "../save-processing.ts";
	import {
		runBackupCommand,
		writeOriginalBackup,
	} from "../backup-operations.ts";
	import {
		chooseSaveDestination,
		type SaveDownloadStage,
	} from "../../downloadSave.ts";
	import * as Sentry from "@sentry/sveltekit";
	import { onDestroy, tick } from "svelte";
	import { RegistryProvider } from "effect-atom-svelte";
	import { SaveReadError, describeImportError } from "../save-service.ts";
	import { openEditorBlob } from "../editor-model.ts";
	import EditorWorkspace from "./EditorWorkspace.svelte";
	import UploadPanel from "./UploadPanel.svelte";
	import "../../ui/study-theme.css";
	interface Props {
		includeProofs?: boolean;
		legacyHref?: string;
		backupOriginal?: (file: File) => Promise<void>;
		processingLayer: Layer.Layer<SaveProcessor>;
	}
	let {
		includeProofs = false,
		legacyHref,
		backupOriginal,
		processingLayer,
	}: Props = $props();
	let active = $state.raw<Awaited<ReturnType<typeof openEditorBlob>>>();
	let filename = $state("");
	let opening = $state(false);
	let openingStatus = $state("Opening save…");
	let importController: AbortController | undefined;
	let error = $state("");
	let downloadError = $state("");
	let downloading = $state(false);
	let downloadStatus = $state("");
	// File reads cannot be canceled reliably. A generation token prevents an older
	// import from installing its session after replacement, cancellation or unmount.
	let generation = 0;
	// A closing screen cancels a pending picker/export. Download URLs have their
	// own bounded timer so a just-started Safari stream is not revoked on close.
	let downloadController = new AbortController();
	// All release paths detach consumers before disposing their borrowed registry.
	// Keeping this ordering in one helper avoids drift between close/replacement.
	async function detach() {
		// Import owns a worker before active exists. Cancel that acquisition too;
		// its rejected openEditorBlob promise closes the not-yet-installed file scope.
		importController?.abort();
		importController = undefined;
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
		openingStatus = "Reading save…";
		error = "";
		downloadError = "";
		await detach();
		if (token !== generation) return;
		const controller = new AbortController();
		importController = controller;
		try {
			// Send the original file to the processing worker; it opens a byte stream.
			if (token !== generation) return;
			openingStatus = "Opening save…";
			const opened = await openEditorBlob(
				processingLayer,
				file,
				{},
				{ includeProofs, signal: controller.signal },
			);
			if (token !== generation) {
				await opened.close();
				return;
			}
			active = opened;
			filename = file.name;
			// Back up only a successfully decoded import. Failure must not block
			// editing; retain the original selected file and surface the warning.
			if (saveBackup && backupOriginal) {
				openingStatus = "Backing up original save…";
				const result = await runBackupCommand(
					writeOriginalBackup(file, backupOriginal),
					(message) => {
						if (token === generation) error = message;
					},
				);
				if (token === generation && result && Result.isFailure(result))
					error = result.failure.message;
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
			if (importController === controller) importController = undefined;
			if (token === generation) opening = false;
		}
	}
	// Export is queued with edits by the model. A file closed/replaced while that
	// work runs must not trigger a download for the wrong active workspace.
	async function download(mode: "picker" | "download" = "picker") {
		const current = active;
		if (!current || downloading) return;
		// Per-attempt context never includes the filename or document. Keep it local
		// so overlapping teardown/replacement cannot attach another save's context.
		const started = performance.now();
		let stage: SaveDownloadStage | "export" = "picker";
		const diagnostics = () => ({
			mode,
			stage,
			duration_ms: Math.round(performance.now() - started),
		});
		// A standard download only proves handoff to the browser, not a disk write.
		// Outcome logs let us measure recovery use without claiming disk success.
		const outcome = (value: string) =>
			Sentry.logger.info("Save download outcome", {
				...diagnostics(),
				outcome: value,
			});
		downloading = true;
		downloadStatus =
			mode === "picker" ? "Choose where to save…" : "Preparing save…";
		// A retry clears only download feedback, leaving backup warnings intact.
		downloadError = "";
		try {
			// Reserve the destination while the click still grants user activation.
			// No file is opened for writing until export and validation succeed.
			// Recovery explicitly bypasses the picker, but still exports the latest
			// session through validation before starting a standard browser download.
			const signal = downloadController.signal;
			const destination = await chooseSaveDestination(
				filename,
				signal,
				mode,
				(next) => {
					stage = next;
				},
			);
			if (active !== current) return;
			if (!destination) {
				outcome("cancelled");
				return;
			}
			downloadStatus = "Preparing save…";
			stage = "export";
			const result = await current.model.commands.export();
			if (!result || active !== current) return;
			if (Result.isFailure(result)) {
				outcome("export_rejected");
				// The workspace displays returned failures itself. Recovery runs
				// outside that action, so publish its validation feedback here too.
				if (mode === "download") downloadError = result.failure.message;
				return result;
			}
			downloadStatus = "Writing save…";
			// The exporter returns ArrayBuffer-backed bytes. Pass them directly to
			// Blob rather than allocating another Uint8Array on the main thread.
			const completed = await destination.write(
				new Blob([result.success], {
					type: "application/octet-stream",
				}),
				signal,
			);
			outcome(
				completed
					? diagnostics().stage === "download"
						? "download_started"
						: "written"
					: "cancelled",
			);
		} catch (cause) {
			// Browser file writes live at the application boundary. A failure
			// leaves the session/draft intact and permits an explicit retry.
			outcome("failed");
			// Console capture already creates the error event. Scope its metadata
			// synchronously to avoid duplicate events or tags leaking to other work.
			Sentry.withScope((scope) => {
				scope.setTag("save_download.stage", stage);
				scope.setTag("save_download.mode", mode);
				scope.setTag(
					"save_download.error_name",
					cause instanceof Error || cause instanceof DOMException
						? cause.name
						: "Unknown",
				);
				scope.setContext("save_download", diagnostics());
				console.error("Save download failed", cause);
			});
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

<div class="editor-application" class:has-session={!!active}>
	{#if active}
		{#if opening}
			<p role="status">{openingStatus}</p>
		{/if}
		{#if error}
			<p role="alert">{error}</p>
		{/if}
		{#if downloadError}
			<p role="alert">{downloadError}</p>

			<p>
				Your edits are still open. Download a copy using your browser, or try
				Export save again.
			</p>

			<button
				type="button"
				class="study-button study-button--constructive study-button--filled"
				disabled={downloading}
				onclick={() => void download("download")}
			>
				Download a copy
			</button>
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
					{downloadStatus}
					{filename}
					onclose={() => void close()}
					ondownload={download}
				/>
			</RegistryProvider>
		{/key}
	{:else}
		<UploadPanel
			{opening}
			status={openingStatus}
			{error}
			{legacyHref}
			onfile={(file) => load(file)}
			onoriginal={(file) => load(file, false)}
			oncancel={() => void close()}
		/>
	{/if}
</div>

<style>
	.editor-application {
		/* The flex parent's centered children otherwise shrink to intrinsic content.
		   Opening a catalog must not resize the frame or move every slot. */
		width: 100%;
		min-width: 0;
		padding: 8px;
	}
	@media (min-width: 901px) {
		/* Alerts and validation keep their natural height; the frame takes the rest. */
		.has-session {
			display: flex;
			flex-direction: column;
			flex: 1;
			min-height: 0;
		}
	}
	[role="alert"] {
		color: #8a1c19;
	}
</style>
