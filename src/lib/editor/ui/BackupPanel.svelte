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
	let {
		onopen,
		disabled = false,
	}: { onopen: (file: File) => Promise<void>; disabled?: boolean } = $props();
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
				The five latest successful imports are kept in this browser. These files
				contain the original bytes, before editing.
			</p>
		</div>
		<button
			type="button"
			disabled={loading || busy || disabled}
			onclick={() => void refresh()}
		>
			Refresh backups
		</button>
	</header>
	{#if error}
		<p role="alert">{error}</p>
	{/if}
	{#if loading}
		<p role="status">Loading backups…</p>
	{:else if rows.length === 0}
		<p>No original backups are stored in this browser.</p>
	{:else}
		<div class="backups">
			{#each rows as backup (backup.rowId)}
				<article aria-label={`${backup.name} backup`}>
					<div>
						<h3 data-sentry-mask="">{backup.name}</h3>
						{#if backup.lastModified !== undefined}
							<p>{new Date(backup.lastModified).toLocaleString()}</p>
						{/if}
						{#if backup.size !== undefined}
							<small>{(backup.size / 1024 / 1024).toFixed(2)} MB</small>
						{/if}
						{#if backup.reason}
							<p role="status">{backup.reason}</p>
						{/if}
					</div>
					<div class="actions">
						{#if backup.file}
							<button
								type="button"
								disabled={busy || disabled}
								onclick={() => {
									if (backup.file) void open(backup.file);
								}}
							>
								Open original
							</button>
							<button
								type="button"
								disabled={busy || disabled}
								onclick={() => {
									if (backup.file) void download(backup.file);
								}}
							>
								Download original
							</button>
						{/if}
						{#if backup.key !== undefined}
							<ConfirmAction
								title="Delete this original backup?"
								description="This removes only the selected browser backup. Download a copy first if you need to keep it. This deletion cannot be undone."
								label="Delete backup"
								disabled={busy || disabled}
								commit={() => remove(backup.key)}
								oncomplete={() => void refresh()}
							/>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	section {
		margin-top: 18px;
		border-top: 1px solid #b88b51;
		padding-top: 18px;
	}
	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
	}
	h2 {
		font-size: 22px;
		margin: 0;
	}
	h3 {
		font-size: 17px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	p {
		font-size: 14px;
		margin: 6px 0;
	}
	small {
		color: #735436;
	}
	.backups {
		display: grid;
		gap: 12px;
		margin-top: 14px;
	}
	article {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 14px;
		background: #fff4dc;
		border: 1px solid #c4a16f;
		padding: 14px;
		border-radius: 8px;
	}
	article > div {
		min-width: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	button {
		font: inherit;
		color: inherit;
		background: #efd29a;
		border: 1px solid #a9814a;
		border-radius: 6px;
		padding: 8px 12px;
		min-height: 40px;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	[role="alert"] {
		color: #972e1c;
	}
</style>
