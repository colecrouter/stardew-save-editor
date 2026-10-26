<script lang="ts" module>
	const SKIP_KEY = "skipBackupReminder";

	/** Whether the player asked not to be reminded again (on this device) */
	export function backupReminderSkipped() {
		try {
			return localStorage.getItem(SKIP_KEY) === "true";
		} catch {
			return false;
		}
	}
</script>

<script lang="ts">
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";

	interface Props {
		/** The save's file (and folder) name, e.g. Farm_123456789 */
		filename: string;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let { filename, onconfirm, oncancel }: Props = $props();

	let dontRemind = $state(false);
	let saveButton = $state<HTMLButtonElement>();
	$effect(() => saveButton?.focus());

	const confirm = () => {
		if (dontRemind) {
			try {
				localStorage.setItem(SKIP_KEY, "true");
			} catch {
				// Storage unavailable (e.g. private mode): just remind next time
			}
		}
		onconfirm();
	};
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && oncancel()} />

<div class="backdrop" role="presentation" onclick={oncancel}></div>
<div
	class="dialog"
	role="dialog"
	aria-modal="true"
	aria-labelledby="backup-title"
	data-testid="backup-reminder"
>
	<UiContainer>
		<h3 id="backup-title">💾 Back up your save first</h3>
		<p>
			Downloading won't change your game save. But if you're going to
			<strong>replace your game save</strong> with this file, copy the original first,
			in case anything goes wrong.
		</p>
		<p>
			Back up the whole <code>{filename || "save"}</code> folder from your Saves
			folder. On Windows that's:
			<code class="path">%appdata%\StardewValley\Saves</code>
		</p>
		<p class="small">
			The editor also keeps temporary backups of the saves you upload: click the
			CD icon on the upload page.
		</p>
		<label class="dont-remind">
			<UiCheckbox bind:checked={dontRemind} data-testid="backup-dont-remind" />
			<small>Don't remind me again</small>
		</label>
		<div class="buttons">
			<button type="button" onclick={oncancel} data-testid="backup-cancel">
				Cancel
			</button>
			<button
				type="button"
				class="primary"
				bind:this={saveButton}
				onclick={confirm}
				data-testid="backup-confirm"
			>
				Download save
			</button>
		</div>
	</UiContainer>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: #0006;
		z-index: 200;
	}

	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: min(460px, calc(100vw - 32px));
	}

	h3 {
		margin-top: 0;
	}

	code {
		color: inherit;
		background: #0000001a;
		padding: 0 4px;
		border-radius: 3px;
		overflow-wrap: anywhere;
	}

	code.path {
		display: block;
		width: fit-content;
		margin-top: 4px;
	}

	.small {
		font-size: 0.85em;
		opacity: 0.85;
	}

	.dont-remind {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 12px;
	}

	.buttons button {
		font: inherit;
		padding: 4px 12px;
		border: solid 2px #9c613b;
		border-bottom-color: #6f3b31;
		border-right-color: #6f3b31;
		border-radius: 4px;
		background-color: #f9bb65;
		color: inherit;
		cursor: pointer;
	}

	.buttons button.primary {
		font-weight: bold;
	}

	.buttons button:hover {
		filter: brightness(0.92);
	}
</style>
