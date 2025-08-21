<script lang="ts">
	import { getToastManager } from "$lib/ToastManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import { fly } from "svelte/transition";

	const manager = getToastManager();
</script>

<div class="toasts">
	{#each manager.toasts as toast}
		<div class="toast" transition:fly={{ y: -100 }}>
			<UiContainer>
				<div class="content">
					<div class="icon">
						{toast.icon}
					</div>
					{toast.message}
				</div>
			</UiContainer>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.toast {
		border-radius: 4px;
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.content {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.icon {
		font-size: 1.5em;
	}
</style>
