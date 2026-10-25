<script lang="ts">
	import { tick } from "svelte";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
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
	<div class="outer-wrapper">
		<Router />
		<div class="inner-wrapper">
			<div class="content">
				{@render children()}
			</div>
			<div class="sidebar">
				<UiButton
					onclick={() => cancel()}
					alt="Exit"
					data-testid="cancel-button"
					>❌
				</UiButton>
				<UiButton
					onclick={() => download()}
					alt="Save"
					pending={isDownloading}
					data-testid="save-button"
					>💾
				</UiButton>
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
		</div>
	</div>
{/if}

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* The current character, shrunk to fit between the arrows */
	.current-character {
		zoom: 0.5;
		align-self: center;
	}

	.outer-wrapper {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.inner-wrapper {
		display: flex;
		flex-direction: row;
		gap: 8px;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 500px;
	}

	@media (max-width: 600px) {
		.outer-wrapper {
			width: calc(100vw - 32px);
			max-width: 100%;
		}
		.inner-wrapper {
			flex-direction: column;
		}
		.content {
			width: 100%;
			min-width: 0;
		}
		.sidebar {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
		}
	}
</style>
