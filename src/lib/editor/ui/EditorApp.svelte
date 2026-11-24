<script lang="ts">
	import { Effect, type Layer, Result } from "effect";
	import { RegistryProvider } from "effect-atom-svelte";
	import { onDestroy, tick } from "svelte";

	import {
		runBackupCommand,
		writeOriginalBackup,
	} from "../backup-operations.ts";
	import { openEditorBlob } from "../editor-model.ts";
	import { startEditorExport } from "../export-workflow.ts";
	import type { SaveProcessor } from "../save-processing.ts";
	import { describeImportError, SaveReadError } from "../save-service.ts";
	import EditorWorkspace from "./EditorWorkspace.svelte";
	import UploadPanel from "./UploadPanel.svelte";

	// Apply theme refinements after EditorWorkspace registers native control styles.
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
	let offerDownloadCopy = $state(false);
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
		previous?.model.stopAcceptingCommands();
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
		offerDownloadCopy = false;
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
		offerDownloadCopy = false;
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
	// Keep feedback owned by the same session, even if a browser operation
	// settles after the user closes or replaces the save.
	async function download(mode: "picker" | "download" = "picker") {
		const current = active;
		if (!current || downloading) return;
		downloading = true;
		downloadStatus =
			mode === "picker" ? "Choose where to save…" : "Preparing save…";
		try {
			const result = await Effect.runPromise(
				startEditorExport(
					filename,
					mode,
					downloadController.signal,
					current.model.commands.export,
					(status) => {
						if (active === current) downloadStatus = status;
					},
				),
			);
			if (active !== current) return;
			switch (result.outcome) {
				case "export_rejected":
					// The workspace renders command failures. Copy runs outside
					// its action handler, so publish its validation failure here.
					if (mode === "download")
						downloadError = result.result.failure.message;
					return result.result;
				case "written":
				case "download_started":
					downloadError = "";
					offerDownloadCopy = false;
					return;
				case "failed":
					// A browser download is an alternate route for native file failures.
					offerDownloadCopy =
						result.stage !== "export" && result.stage !== "download";
					switch (result.stage) {
						case "picker":
							downloadError = "The save picker couldn't open.";
							break;
						case "export":
							downloadError = "The edited save couldn't be prepared.";
							break;
						case "download":
							downloadError = "The browser couldn't start the download.";
							break;
						default:
							downloadError =
								"The edited save couldn't be written to the selected file.";
					}
					return;
				// Leave existing recovery visible if the user cancels a retry.
				case "cancelled":
				case "abandoned":
					return;
			}
		} finally {
			if (active === current) downloading = false;
		}
	}

	onDestroy(() => {
		generation++;
		void detach();
	});
</script>

<div
	class="editor-application"
	class:has-session={!!active}
>
	{#if active}
		{#if opening}
			<p role="status">{openingStatus}</p>
		{/if}
		{#if error}
			<p role="alert">{error}</p>
		{/if}
		{#if active.model.loadValidation.errors.length || active.model.loadValidation.warnings.length}
			<details class="validation">
				<summary>Imported save has existing problems</summary>
				<ul>
					<!-- Diagnostic positions preserve repeated messages within this immutable load report. -->
					{#each [...active.model.loadValidation.errors, ...active.model.loadValidation.warnings] as problem, index (index)}
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
		<!-- Each keyed mount retains its own session until Svelte removes it.
		     Clearing active must not invalidate the old workspace's props. -->
		{#each [active] as session (session)}
			<RegistryProvider registry={session.model.atomBindings.registry}>
				<EditorWorkspace
					model={session.model}
					{includeProofs}
					{downloading}
					{downloadStatus}
					{downloadError}
					{offerDownloadCopy}
					{filename}
					onclose={() => void close()}
					ondownload={download}
					ondismissdownloaderror={() => {
						// Dismiss only the feedback so the user can keep editing.
						downloadError = "";
						offerDownloadCopy = false;
					}}
				/>
			</RegistryProvider>
		{/each}
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
