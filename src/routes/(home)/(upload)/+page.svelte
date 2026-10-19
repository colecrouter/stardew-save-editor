<script lang="ts">
	import { preventDefault } from "svelte/legacy";

	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";

	let submit = $state<HTMLInputElement>();
	let files = $state<FileList>();
	const saveManager = getSaveManager();
	const toastManager = getToastManager();

	let uploading = $state(false);

	const handle = async () => {
		// We have to instantiate the filelist here because it's not available in node
		if (!files) files = new FileList();

		const file = files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("file", file);

		try {
			uploading = true;
			await saveManager.import(file);

			goto(resolve("/inventory"));

			toastManager.add(new Toast("Save file uploaded!", "success"));
		} catch (e) {
			// Not always an Error: pako throws a string for a corrupt compressed save
			const message = e instanceof Error ? e.message : String(e);
			toastManager.add(new Toast(message, "failure"));
			uploading = false;
		}
	};
</script>

<section>
	<UiContainer>
		<form onsubmit={preventDefault(handle)} method="POST">
			<div class="dropzone">
				<input
					type="file"
					accept=""
					name="file"
					required
					aria-label="Save file"
					bind:files
					disabled={uploading}
					onchange={() => {
						return submit?.click();
					}}
				/>
				<span class="hint" aria-hidden="true" data-testid="upload-hint">
					{uploading
						? "Uploading..."
						: "Click to select a file, or drag and drop here"}
				</span>
			</div>
			<input type="submit" value="Upload" bind:this={submit} hidden />
			<small>
				Default save locations:
				<ul>
					<li>
						<span class="noselect">Windows:</span>
						<code>%appdata%\StardewValley\Saves </code>
					</li>
					<li>
						<span class="noselect">Mac:</span><code>
							~/Library/Application Support/StardewValley/Saves
						</code>
					</li>
					<li>
						<span class="noselect">Linux:</span>
						<code>~/.config/StardewValley/Saves</code>
					</li>
					<li>
						<span class="noselect">*Android:</span>
						<code>
							/Android/data/com.chucklefish.stardewvalley/files/Saves
						</code>
					</li>
					<li>
						<span class="noselect">iOS:</span>
						<code> Locations -> On My iPhone/iPad -> Stardew Valley </code>
					</li>
				</ul>

				<p style="font-size: 0.8em">
					*On Android 14 or later, the apps folder is hidden. You can use an app
					<a
						href="https://play.google.com/store/apps/details?id=com.marc.files"
						target="_blank"
						rel="noopener noreferrer">such as this one</a
					> to access it.
				</p>

				<div class="warning">
					<p>
						<strong
							>Always backup your save file. Corrupt save files may break the
							game.</strong
						> You take full responsibility by using this tool.
					</p>
				</div>

				<p>
					You can access temporary backups of your saves by clicking the CD
					icon.
				</p>
				<p>
					If you find a problem, please report it <a
						href="https://github.com/colecrouter/stardew-save-editor/issues"
						>on GitHub</a
					>.
				</p>
			</small>
		</form>
	</UiContainer>
</section>

<style>
	section {
		max-width: min-content;
	}

	form {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	/* Big striped Drag and Drop File Upload */
	.dropzone {
		position: relative;
		width: 400px;
		max-width: 100%;
		margin: 20px auto;
	}

	input[type="file"] {
		display: block;
		box-sizing: border-box;
		border: 2px dashed #8e3d04;
		border-radius: 5px;
		width: 100%;
		padding: 54px 0;
		color: transparent;
		font-size: 0;
	}

	/* Sits over the input; clicks and drops pass through to it */
	.hint {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 1rem;
		text-align: center;
		color: #b98a63;
		font-size: 1rem;
		pointer-events: none;
	}

	input[type="file"]:focus {
		outline: none;
	}

	input[type="file"]:hover {
		cursor: pointer;
	}

	input[type="file"]::file-selector-button {
		display: none;
	}

	input[type="file"]:disabled {
		pointer-events: none;
		touch-action: none;
		backdrop-filter: brightness(0.75);
	}

	ul {
		list-style: none;
		padding: 0;
	}

	li {
		margin-top: 0.3em;
		white-space: nowrap;
	}

	li span {
		margin-right: 0.5em;
	}

	.noselect {
		user-select: none;
	}

	.warning {
		background-color: rgba(255, 0, 0, 0.35);
		border-left: solid 4px rgba(255, 0, 0, 0.7);
	}

	.warning > * {
		padding: 0.2rem;
		padding-left: 0.5rem;
		margin-block-start: 0.2em;
		margin-block-end: 0.2em;
	}
</style>
