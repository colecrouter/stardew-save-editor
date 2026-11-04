<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { Effect, Result } from "effect";
	import {
		readOriginalBackups,
		deleteOriginalBackup,
		downloadOriginalBackup,
		runBackupCommand,
		type OriginalBackup,
	} from "../backup-operations.ts";
	import ConfirmAction from "./ConfirmAction.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	interface Props {
		onopen: (file: File) => Promise<void>;
		disabled?: boolean;
	}
	let { onopen, disabled = false }: Props = $props();
	let rows = $state<OriginalBackup[]>([]);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state("");
	let mounted = true;
	const downloads = new AbortController();
	const report = (message: string) => {
		if (mounted) error = message;
	};
	async function refresh() {
		if (mounted) {
			loading = true;
			error = "";
		}
		const result = await runBackupCommand(readOriginalBackups(), report);
		if (!mounted) return;
		if (result && Result.isSuccess(result)) rows = result.success;
		if (result && Result.isFailure(result)) error = result.failure.message;
		loading = false;
	}
	async function download(file: File) {
		busy = true;
		error = "";
		const result = await runBackupCommand(
			downloadOriginalBackup(file, downloads.signal),
			report,
		);
		if (!mounted) return;
		if (result && Result.isFailure(result)) error = result.failure.message;
		busy = false;
	}
	async function open(file: File) {
		busy = true;
		error = "";
		// EditorApp owns import generations and expected import feedback. Opening an
		// archived original uses that same flow without appending a duplicate backup.
		await runBackupCommand(
			Effect.promise(() => onopen(file)),
			report,
		);
		if (mounted) busy = false;
	}
	async function remove(key: number | undefined) {
		busy = true;
		error = "";
		const result = await runBackupCommand(deleteOriginalBackup(key), report);
		if (mounted) busy = false;
		return result;
	}
	onMount(() => {
		void refresh();
	});
	onDestroy(() => {
		mounted = false;
		downloads.abort();
	});
</script>

<section aria-label="Original save backups">
	<header>
		<div>
			<h2>Original save backups</h2>

			<p>
				The five latest successful imports, kept in this browser. Originals
				contain the file as it was opened, before any edits.
			</p>
		</div>

		<StudyButton
			disabled={loading || busy || disabled}
			onclick={() => void refresh()}
		>
			Refresh backups
		</StudyButton>
	</header>

	{#if error}
		<StudyAlert title="Backups unavailable" tone="danger" live="assertive">
			{error}
		</StudyAlert>
	{/if}

	{#if loading}
		<p class="empty" role="status">Loading backups…</p>
	{:else if rows.length === 0}
		<div class="empty">
			<h3>Your originals will appear here</h3>

			<p>No original backups are stored in this browser.</p>

			<p>
				Open a save file to keep its original here. Keep a separate copy for
				safekeeping.
			</p>
		</div>
	{:else}
		<div class="backups">
			{#each rows as backup (backup.rowId)}
				<article aria-label={`${backup.name} backup`}>
					<div class="file-details">
						<h3 data-sentry-mask="">{backup.name}</h3>

						<!-- This timestamp belongs to the selected file, not the import
						     or an in-game save date. Do not imply archive metadata we lack. -->
						<div class="metadata">
							{#if backup.lastModified !== undefined}
								<span>
									File modified {new Date(backup.lastModified).toLocaleString()}
								</span>
							{/if}

							{#if backup.size !== undefined}
								<span>{(backup.size / 1024 / 1024).toFixed(2)} MB</span>
							{/if}
						</div>

						{#if backup.reason}
							<p class="unavailable" role="status">{backup.reason}</p>
						{/if}
					</div>

					<div class="actions">
						{#if backup.file}
							<StudyButton
								intent="constructive"
								disabled={busy || disabled}
								onclick={() => {
									if (backup.file) void open(backup.file);
								}}
							>
								Open original
							</StudyButton>

							<StudyButton
								disabled={busy || disabled}
								onclick={() => {
									if (backup.file) void download(backup.file);
								}}
							>
								Download original
							</StudyButton>
						{/if}

						{#if backup.key !== undefined}
							<div class="delete-action">
								<ConfirmAction
									title="Delete this original backup?"
									description="This removes only the selected browser backup. Download a copy first if you need to keep it. This deletion cannot be undone."
									label="Delete backup"
									disabled={busy || disabled}
									commit={() => remove(backup.key)}
									oncomplete={() => void refresh()}
								/>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	section {
		min-width: 0;
	}
	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 18px;
	}
	header > div {
		flex: 1 1 300px;
	}
	h2 {
		font-size: 25px;
		margin: 0;
	}
	h3 {
		font-size: 22px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	p {
		font-size: 18px;
		line-height: 1.4;
		margin: 8px 0 0;
	}
	.backups {
		display: grid;
		gap: 0;
		border-top: 2px solid var(--study-rule, #b88b51);
	}
	article {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 14px;
		padding: 16px 0;
		border-bottom: 1px solid var(--study-rule, #b88b51);
	}
	.file-details {
		flex: 1 1 260px;
		min-width: 0;
	}
	.metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 18px;
		font-size: 17px;
		line-height: 1.4;
		color: var(--study-muted, #735436);
		margin-top: 6px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.delete-action {
		/* The existing confirmation owner keeps its transaction/focus behavior;
		   only this destructive action borrows the shared warm danger palette. */
		--ui-control-bg: var(--study-paper-light, #fdedd7);
		--ui-control-text: var(--study-danger, #8a281c);
		--ui-border-dark: var(--study-danger, #8a281c);
		--ui-border-light: #bd765c;
	}
	.empty {
		padding: 24px;
		background: var(--study-paper-light, #fdedd7);
		border: 2px dashed var(--study-rule, #b88b51);
		text-align: center;
	}
	.empty p:last-child {
		color: var(--study-muted, #735436);
	}
	.unavailable {
		color: var(--study-danger, #8a281c);
	}
	@media (max-width: 600px) {
		.empty {
			padding: 20px 14px;
		}
		.actions {
			width: 100%;
		}
	}
</style>
