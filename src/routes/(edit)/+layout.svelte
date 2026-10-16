<script lang="ts">
	import { tick } from "svelte";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { getSaveManager, SaveValidationError } from "$lib/SaveManager.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
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
		isDownloading = true;
		// Let a field that's mid-edit commit or fall back to a valid value before exporting
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
		await tick();
		return saveManager
			.download()
			.then(() =>
				toastManager.add(
					new Toast("Save file validated and downloaded!", "success"),
				),
			)
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
					data-testid="save-button"
					>💾
				</UiButton>
				<UiButton
					alt="Previous Character"
					onclick={() => saveManager.save?.prevFarmer()}
					disabled={saveManager.save.players.length <= 1}
					>⬅️
				</UiButton>
				<UiButton
					alt="Next Character"
					onclick={() => saveManager.save?.nextFarmer()}
					disabled={saveManager.save.players.length <= 1}
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
</style>
