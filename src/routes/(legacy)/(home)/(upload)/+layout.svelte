<script lang="ts">
	import { resolve } from "$app/paths";
	import UiButton from "$lib/ui/UIButton.svelte";

	interface Props {
		children: import("svelte").Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="wrapper">
	{@render children()}

	<nav>
		<UiButton href={resolve(`/backups`)} alt="Backups">💿</UiButton>
	</nav>
</div>

<style>
	.wrapper {
		display: flex;
		flex-direction: row;
		gap: 8px;
		justify-content: start;
	}

	nav {
		display: flex;
		flex-direction: row;
		gap: 8px;
		justify-content: start;
		padding: 2px;
	}
</style>
