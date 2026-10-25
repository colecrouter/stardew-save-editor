<script lang="ts">
	import { tick } from "svelte";
	import { goto } from "$app/navigation";
	import { asset, resolve } from "$app/paths";
	import "$lib/ui/study-theme.css";
	import StudyFrame from "$lib/ui/StudyFrame.svelte";
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
		<StudyFrame>
			<header class="editor-header">
				<strong class="brand">Stardew Save Editor</strong>
				<div class="loaded-save">
					Loaded save: <span data-sentry-mask>{saveManager.filename}</span>
				</div>
				<UiButton
					variant="plain"
					class="export"
					onclick={() => download()}
					pending={isDownloading}
					alt="Export save"
					data-testid="save-button">Export save</UiButton
				>
				<UiButton
					variant="plain"
					onclick={cancel}
					alt="Exit"
					data-testid="cancel-button">Exit</UiButton
				>
			</header>
			<div class="inner-wrapper">
				<Router />
				<div class="content" id="editor-content" tabindex="-1">
					{@render children()}
				</div>
			</div>
			<div class="sidebar" aria-label="Current farmer">
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
			</div>
		</StudyFrame>
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
	.sidebar {
		display: flex;
		justify-content: end;
		align-items: center;
		gap: 8px;
	}

	/* The current character, shrunk to fit between the arrows */
	.current-character {
		zoom: 0.5;
		align-self: center;
	}

	.outer-wrapper {
		width: min(1472px, calc(100vw - 64px));
	}
	.editor-header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
		padding: 16px 20px;
		border-bottom: 8px ridge #a26726;
		background: linear-gradient(100deg, #ffe6ad, #f8d18b);
	}
	.brand {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 29px;
		margin-right: auto;
	}
	.loaded-save {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 24px;
	}
	.loaded-save span {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		border: 2px solid #b68e56;
		padding: 7px 12px;
		background: #ffedc5;
	}
	.editor-header :global(.export) {
		background: linear-gradient(#249a4c, #10733d);
		color: #fff5d6;
		border: 3px solid #164e28;
		box-shadow:
			inset 0 0 0 2px #5db45b,
			0 2px #663c1a;
		min-width: 180px;
	}

	.inner-wrapper {
		display: grid;
		grid-template-columns: 250px minmax(0, 1fr);
		min-height: 740px;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		padding: 24px;
		background: radial-gradient(ellipse at 40% 30%, #fff0cc, #f9d697);
	}
	@media (max-width: 1150px) {
		.inner-wrapper {
			grid-template-columns: 200px minmax(0, 1fr);
		}
		.loaded-save {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.outer-wrapper {
			width: calc(100vw - 20px);
			max-width: 100%;
		}
		.inner-wrapper {
			grid-template-columns: minmax(0, 1fr);
			min-height: 0;
		}
		.content {
			width: 100%;
			min-width: 0;
			padding: 16px 8px;
		}
		.editor-header {
			padding: 10px;
			gap: 8px;
		}
		.brand {
			width: 100%;
			font-size: 25px;
		}
		.sidebar {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
		}
	}
</style>
