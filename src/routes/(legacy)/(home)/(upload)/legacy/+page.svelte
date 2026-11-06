<script lang="ts">
	import { preventDefault } from "svelte/legacy";

	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import { describeResult } from "$lib/saveValidation";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";

	let submit = $state<HTMLInputElement>();
	let files = $state<FileList>();
	const saveManager = getSaveManager();
	const toastManager = getToastManager();

	let uploading = $state(false);

	const locations = [
		{ os: "Windows", path: String.raw`%appdata%\StardewValley\Saves` },
		{ os: "Mac", path: "~/Library/Application Support/StardewValley/Saves" },
		{ os: "Linux", path: "~/.config/StardewValley/Saves" },
		{
			os: "*Android",
			path: "/Android/data/com.chucklefish.stardewvalley/files/Saves",
		},
	];

	const copyPath = async (os: string, path: string) => {
		// The user is highlighting the text to copy it by hand; don't interfere
		if (getSelection()?.toString()) return;
		try {
			await navigator.clipboard.writeText(path);
			toastManager.add(
				new Toast(`Copied ${os.replace("*", "")} path`, "success"),
			);
		} catch {
			toastManager.add(new Toast("Couldn't copy to the clipboard", "failure"));
		}
	};

	const handle = async () => {
		// We have to instantiate the filelist here because it's not available in node
		if (!files) files = new FileList();

		const file = files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("file", file);

		try {
			uploading = true;
			if (!(await saveManager.import(file))) return;
			const validation = $state.snapshot(saveManager.loadValidation);

			goto(resolve("/inventory"));

			// Opened even if there are problems, so they can be fixed in the editor
			const { message, type, duration } = describeResult(
				"uploaded",
				validation,
			);
			toastManager.add(new Toast(message, type), duration);
			if (type !== "success") console.warn("Save file problems", validation);
		} catch (e) {
			// Not always an Error: pako throws a string for a corrupt compressed save
			const message = e instanceof Error ? e.message : String(e);
			toastManager.add(new Toast(message, "failure"));
			uploading = false;
		}
	};
</script>

<section>
	<p>
		<a href={resolve("/")}>Try v2 editing with undo and change review</a>
	</p>
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
					{#each locations as { os, path } (os)}
						<li>
							<span class="noselect">{os}:</span>
							<!-- Not a <button>: Firefox and Safari don't let you select a button's text -->
							<span
								class="copy"
								role="button"
								tabindex="0"
								title="Copy path to clipboard"
								onclick={() => copyPath(os, path)}
								onkeydown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										copyPath(os, path);
									}
								}}
							>
								<code>{path}</code>
							</span>
						</li>
					{/each}
					<li>
						<span class="noselect">iOS:</span>
						<code> Locations -> On My iPhone/iPad -> Stardew Valley </code>
					</li>
				</ul>

				<p>
					For desktop and mobile save locations, file access limits and
					replacement steps, see the
					<a
						href="https://github.com/colecrouter/stardew-save-editor/blob/main/SUPPORT.md"
					>
						save guide
					</a>. Its Review and Undo instructions apply to v2.
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

	li .copy {
		user-select: text;
		cursor: pointer;
		outline: none;
	}

	li .copy code {
		border: 1px solid #d3d3d3;
	}

	li .copy:hover code,
	li .copy:focus-visible code {
		border-color: #999;
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
