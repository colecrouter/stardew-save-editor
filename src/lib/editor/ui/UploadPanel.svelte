<script lang="ts">
	import { onDestroy } from "svelte";
	import { Result } from "effect";
	import { copySaveLocation, runEntryCommand } from "../entry-operations.ts";
	import StudyFrame from "../../ui/StudyFrame.svelte";
	import ParchmentPane from "../../ui/frame/ParchmentPane.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import BackupPanel from "./BackupPanel.svelte";

	interface Props {
		opening: boolean;
		error: string;
		legacyHref?: string;
		onfile: (file: File) => Promise<void>;
		onoriginal: (file: File) => Promise<void>;
		oncancel: () => void;
	}
	let { opening, error, legacyHref, onfile, onoriginal, oncancel }: Props =
		$props();
	let backupsOpen = $state(false);
	let copying = $state(false);
	let copyFeedback = $state("");
	let copyFailed = $state(false);
	let mounted = true;
	const locations = [
		{ os: "Windows", path: String.raw`%appdata%\StardewValley\Saves` },
		{ os: "macOS", path: "~/Library/Application Support/StardewValley/Saves" },
		{ os: "Linux", path: "~/.config/StardewValley/Saves" },
		{
			os: "Android",
			path: "/Android/data/com.chucklefish.stardewvalley/files/Saves",
		},
	] as const;
	async function copyPath(os: string, path: string) {
		if (copying) return;
		copying = true;
		copyFeedback = "";
		copyFailed = false;
		const result = await runEntryCommand(
			copySaveLocation(path),
			(message) => {
				if (mounted) {
					copyFeedback = message;
					copyFailed = true;
				}
			},
			{
				context: "clipboard",
				message: "The path could not be copied. Please try again.",
			},
		);
		// Clipboard promises cannot be canceled. A departed upload screen must not
		// install feedback into a later screen or acquire another browser action.
		if (!mounted) return;
		if (result && Result.isFailure(result)) {
			copyFeedback = result.failure.message;
			copyFailed = true;
		} else if (result) copyFeedback = `Copied ${os} save location.`;
		copying = false;
	}
	onDestroy(() => {
		mounted = false;
	});
</script>

<!-- This is presentation for the existing file lifecycle. EditorApp continues
     to own import cancellation, validation, backup writes and session disposal. -->
<div class="entry study-theme">
	<header class="brand">
		<h1>Stardew Save Editor</h1>
	</header>

	<StudyFrame>
		<ParchmentPane>
			<div class="welcome">
				<section class="open-save" aria-labelledby="open-save-title">
					<h2 id="open-save-title">Open your farm</h2>
					<p class="intro">
						Make yourself at home. Edit your farmer, tend to your inventory, or
						give the farm a new beginning.
					</p>

					<div class="file-picker">
						<label for="farm-save">Save file</label>
						<input
							id="farm-save"
							type="file"
							disabled={opening}
							aria-describedby="save-file-help"
							onchange={(event) => {
								// Pass the browser's original File through unchanged; the owner
								// validates it before preserving an exact original backup.
								const file = event.currentTarget.files?.[0];
								if (file) void onfile(file);
							}}
						/>
						<p id="save-file-help">
							Choose the main save from your farm’s folder, usually named like
							<code>FarmName_123456789</code>
							(not
							<code>SaveGameInfo</code>
							or a ZIP). Supports Stardew Valley 1.6.x saves; older versions cannot
							be opened.
						</p>
					</div>

					{#if opening}
						<div class="import-status">
							<p role="status">Opening save…</p>
							<StudyButton onclick={oncancel}>Cancel import</StudyButton>
						</div>
					{/if}
					{#if error}
						<StudyAlert
							title="Could not open this save"
							tone="danger"
							live="assertive"
						>
							{error}
						</StudyAlert>
					{/if}
				</section>

				<aside class="guide" aria-labelledby="before-you-begin">
					<h2 id="before-you-begin">Before you begin</h2>
					<ol>
						<li>
							<strong>Keep your original.</strong>
							<span>
								Up to five distinct originals are backed up in this browser.
								Keep a separate copy too.
							</span>
						</li>
						<li>
							<strong>Make it yours.</strong>
							<span>Review your changes and use Undo as you edit.</span>
						</li>
						<li>
							<strong>Take it back to the farm.</strong>
							<span>
								Export, close the game, then replace the main save. Check the
								filename for a duplicate suffix.
							</span>
						</li>
					</ol>
					<a
						href="https://github.com/colecrouter/stardew-save-editor/blob/v2/SUPPORT.md"
					>
						Save locations &amp; replacement guide ↗
					</a>
				</aside>
			</div>

			<!-- Paths need the full frame width: keep system, selectable path and Copy
                 together without stretching the instruction column vertically. -->
			<details class="locations">
				<summary>Default save locations</summary>
				<p>
					Copy a path, then use the Save file picker above. Platform access
					restrictions can vary; see the guide for details.
				</p>
				<ul>
					{#each locations as location (location.os)}
						<li>
							<strong>{location.os}</strong>
							<code>{location.path}</code>
							<StudyButton
								disabled={opening || copying}
								aria-label={`Copy ${location.os} save location`}
								onclick={() => void copyPath(location.os, location.path)}
							>
								Copy path
							</StudyButton>
						</li>
					{/each}
					<li>
						<strong>iOS / iPadOS</strong>
						<span class="platform-note">
							Files → On My iPhone/iPad → Stardew Valley
						</span>
					</li>
				</ul>
				<p role={copyFailed ? "alert" : "status"} class="copy-feedback">
					{copyFeedback}
				</p>
			</details>

			<!-- Load the browser archive only when requested. Archived originals
                 reopen through the same import path without creating another copy. -->
			<details class="archive" bind:open={backupsOpen}>
				<summary>
					Original save backups <span>
						Reopen or download an imported original
					</span>
				</summary>
				{#if backupsOpen}
					<BackupPanel disabled={opening} onopen={onoriginal} />
				{/if}
			</details>
			{#if legacyHref}
				<footer class="entry-footer">
					<a href={legacyHref}>Open the legacy editor</a>
				</footer>
			{/if}
		</ParchmentPane>
	</StudyFrame>
</div>

<style>
	.locations {
		border-top: 2px solid #c5a16d;
		padding-block: 20px;
	}
	.locations summary {
		color: #285f30;
	}
	.locations p {
		color: #735436;
		font-size: 19px;
		line-height: 1.35;
	}
	.locations ul {
		list-style: none;
		padding: 0;
		margin: 16px 0;
		display: grid;
		gap: 10px;
	}
	.locations li {
		display: grid;
		grid-template-columns: 112px minmax(0, 1fr) max-content;
		align-items: center;
		gap: 16px;
		padding: 0;
	}
	.locations code {
		min-width: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
		user-select: text;
	}
	.locations :global(button) {
		font-size: 17px;
		padding: 6px 10px;
	}
	.locations .platform-note {
		grid-column: 2 / -1;
		margin: 0;
	}
	.copy-feedback {
		min-height: 1.5em;
	}
	@media (max-width: 600px) {
		.locations li {
			grid-template-columns: minmax(0, 1fr) max-content;
			gap: 6px 12px;
		}
		.locations strong {
			grid-column: 1;
			grid-row: 1;
		}
		.locations :global(button) {
			grid-column: 2;
			grid-row: 1;
		}
		.locations code,
		.locations .platform-note {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}

	.entry {
		max-width: 1100px;
		margin: 36px auto 24px;
	}
	.brand {
		text-align: center;
		margin: 0 24px 24px;
		color: #fff1d0;
		text-shadow: 2px 3px #362811;
	}
	.brand h1 {
		font-size: clamp(32px, 5vw, 48px);
	}
	.welcome {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		gap: 36px;
		padding: 4px 4px 28px;
	}
	h2 {
		margin: 0 0 16px;
	}
	p {
		margin: 0;
	}
	.intro {
		max-width: 34ch;
		font-size: 24px;
		margin-bottom: 24px;
	}
	.file-picker {
		background: #fff1cf;
		border: 2px solid #ba8e53;
		padding: 20px;
		display: grid;
		gap: 12px;
	}
	label {
		font-size: 24px;
	}
	input {
		width: 100%;
		min-width: 0;
		font: inherit;
		color: #694621;
	}
	input::file-selector-button {
		font: inherit;
		background: #35763a;
		color: #fff8e8;
		border: 2px solid #234e28;
		border-radius: 0;
		padding: 10px 14px;
		margin: 0 12px 8px 0;
		min-height: 44px;
		cursor: pointer;
	}
	input:focus-visible {
		outline: 3px solid #176fb4;
		outline-offset: 4px;
	}
	input:disabled {
		opacity: 0.6;
	}
	#save-file-help {
		color: #735436;
		font-size: 19px;
		line-height: 1.35;
	}
	.guide {
		padding-left: 28px;
		border-left: 2px solid #c5a16d;
	}
	.guide h2 {
		font-size: 23px;
	}
	ol {
		margin: 0 0 20px;
		padding-left: 28px;
		display: grid;
		gap: 18px;
	}
	li {
		padding-left: 4px;
	}
	li strong,
	li span {
		display: block;
	}
	li span {
		color: #735436;
		font-size: 19px;
		margin-top: 4px;
	}
	a {
		color: #285f30;
		text-underline-offset: 4px;
	}
	a:focus-visible,
	summary:focus-visible {
		outline: 3px solid #176fb4;
		outline-offset: 4px;
	}
	.import-status {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 16px 0;
	}
	.archive {
		border-top: 2px solid #c5a16d;
		padding-top: 20px;
	}
	summary {
		cursor: pointer;
		font-size: 24px;
		min-height: 44px;
	}
	summary span {
		font-size: 19px;
		color: #735436;
		margin-left: 12px;
	}
	.entry-footer {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 12px;
		padding: 20px 0 4px;
		color: #735436;
	}
	.entry-footer a {
		color: #285f30;
	}
	@media (max-width: 750px) {
		.entry {
			margin-top: 24px;
		}
		.welcome {
			grid-template-columns: minmax(0, 1fr);
			gap: 24px;
		}
		.guide {
			border-left: 0;
			border-top: 2px solid #c5a16d;
			padding: 24px 0 0;
		}
		.file-picker {
			padding: 14px;
		}
		summary span {
			display: block;
			margin: 6px 0 0 20px;
		}
		.intro {
			font-size: 22px;
		}
		.entry-footer {
			font-size: 18px;
		}
	}
</style>
