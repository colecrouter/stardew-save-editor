<script lang="ts">
	import { browser } from "$app/env";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";

	interface Props {
		children?: import("svelte").Snippet;
	}

	let { children }: Props = $props();

	const saveManager = getSaveManager();

	// Preserve the navigation workaround: https://github.com/sveltejs/kit/issues/5434
	// Follow reactive page state after navigation; Kit 3 no longer exposes page stores.
	// Keep the legacy redirect limited to the home path with an already loaded save.
	$effect(() => {
		if (browser && page.url.pathname === "/" && saveManager.save?.raw) {
			void goto(resolve("inventory"));
		}
	});
</script>

<div class="wrapper">
	{@render children?.()}

	<nav>
		<UiButton href={resolve("")} alt="Cancel">❌</UiButton>
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
