<script lang="ts">
	import { tick } from "svelte";
	import { goto } from "$app/navigation";
	import { asset, resolve } from "$app/paths";
	import "$lib/ui/study-theme.css";
	import StudyIcon from "$lib/ui/StudyIcon.svelte";
	import EditorShell from "$lib/ui/frame/EditorShell.svelte";
	import { setUiAssets, resolveUiAssets } from "$lib/ui/uiAssets";
	import { getSaveManager, SaveValidationError } from "$lib/SaveManager.svelte";
	import { describeResult } from "$lib/saveValidation";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import Tooltip from "$lib/ui/Tooltip.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	import CharacterPreview from "./appearance/CharacterPreview.svelte";
	import Router from "./Router.svelte";

	interface Props {
		children: import("svelte").Snippet;
	}

	let { children }: Props = $props();

	const toastManager = getToastManager();
	const saveManager = getSaveManager();
	setUiAssets(resolveUiAssets((_name, path) => asset(path)));

	let isDownloading = $state(false);

	const cancel = () => saveManager.reset();
	const download = async () => {
		if (isDownloading) return;
		isDownloading = true;
		// Let a field that's mid-edit commit or fall back to a valid value before exporting
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
		await tick();
		return saveManager
			.download()
			.then((validation) => {
				// Downloaded, but there may still be warnings to show
				const { message, type, duration } = describeResult(
					"downloaded",
					validation,
				);
				toastManager.add(new Toast(message, type), duration);
				if (type !== "success") console.warn("Save file problems", validation);
			})
			.catch((e) => {
				if (e instanceof SaveValidationError) {
					// Not downloaded: the file would break the game
					toastManager.add(new Toast(e.message, "failure"), 10000);
					console.warn("Save validation failed", e.validation);
					return;
				}
				toastManager.add(new Toast("Failed to download save file", "failure"));
				console.warn(e);
			})
			.finally(() => {
				isDownloading = false;
			});
	};

	$effect(() => {
		if (!saveManager.save) {
			goto(resolve("/"));
		}
	});
</script>

{#if saveManager.save}
	<div class="outer-wrapper study-theme">
		<a class="skip-link" href="#editor-content">Skip to editor</a>
		<EditorShell onclose={cancel}>
			{#snippet header()}<header class="editor-header">
					<strong class="brand"
						><StudyIcon name="chicken" size={30} /> Stardew Save Editor</strong
					>
					<div class="loaded-save">
						Loaded save: <span data-sentry-mask>{saveManager.filename}</span>
					</div>
					<UiButton
						variant="plain"
						class="export"
						onclick={() => download()}
						pending={isDownloading}
						alt="Export save"
						data-testid="save-button"
						><StudyIcon name="save" size={24} /> Export save</UiButton
					>
				</header>{/snippet}
			{#snippet navigation()}<Router />{/snippet}
			{#snippet footer()}{#if saveManager.save && saveManager.save.players.length > 1}<div
						class="sidebar"
						aria-label="Current farmer"
					>
						<UiButton
							alt={`Previous Character: ${saveManager.save.previousPlayer?.name ?? ""}`}
							onclick={() => saveManager.save?.prevFarmer()}
							disabled={saveManager.save.players.length <= 1}
							data-testid="previous-character"
							>⬅️
						</UiButton>
						<Tooltip text={saveManager.save.player.name ?? ""}>
							<div
								class="current-character"
								aria-label={`Current character: ${saveManager.save.player.name}`}
								data-testid="current-character"
							>
								<CharacterPreview player={saveManager.save.player} />
							</div>
						</Tooltip>
						<UiButton
							alt={`Next Character: ${saveManager.save.nextPlayer?.name ?? ""}`}
							onclick={() => saveManager.save?.nextFarmer()}
							disabled={saveManager.save.players.length <= 1}
							data-testid="next-character"
							>➡️
						</UiButton>
					</div>{/if}{/snippet}
			{@render children()}
		</EditorShell>
	</div>
{/if}

<style>
	.skip-link {
		position: fixed;
		left: 16px;
		top: 8px;
		padding: 8px 16px;
		z-index: 20;
		background: #fff3dc;
		color: #351b0e;
		transform: translateY(-160%);
	}
	.skip-link:focus {
		transform: none;
	}
	.outer-wrapper {
		width: min(1440px, 100%);
		--study-frame-height: calc(100dvh - 32px);
	}
	.editor-header {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 42px 12px 18px;
		min-height: 72px;
	}
	.brand {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 25px;
		margin-right: auto;
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.loaded-save {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 21px;
	}
	.loaded-save span {
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		border: 1px solid #b68e56;
		padding: 5px 10px;
		background: #fce3b5;
	}
	.editor-header :global(.export) {
		gap: 8px;
		padding: 4px 14px;
		background: linear-gradient(#25894b, #1e8146);
		color: #fff5d6;
		border: 2px solid #24522a;
		box-shadow:
			inset 0 0 0 1px #7cb96d,
			0 2px #663c1a;
	}
	.sidebar {
		display: flex;
		justify-content: end;
		align-items: center;
		gap: 8px;
	}
	.current-character {
		zoom: 0.5;
	}
	@media (max-width: 1100px) {
		.loaded-save {
			display: none;
		}
	}
	@media (max-width: 900px) {
		.outer-wrapper {
			--study-frame-height: auto;
		}
		.editor-header {
			padding: 12px 30px 12px 12px;
			gap: 8px;
			flex-wrap: wrap;
		}
		.brand {
			font-size: 21px;
			flex: 1 1 100%;
		}
		.editor-header :global(.export) {
			min-height: 44px;
			padding: 3px 12px;
		}
	}
</style>
