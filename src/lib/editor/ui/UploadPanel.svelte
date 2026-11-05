<script lang="ts">
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
								The five latest successful imports are backed up in this
								browser. Keep a separate copy too.
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
