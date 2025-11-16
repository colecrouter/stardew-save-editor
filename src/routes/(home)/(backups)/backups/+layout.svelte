<script lang="ts">
	import { browser } from "$app/environment";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/stores";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	interface Props {
		children?: import("svelte").Snippet;
	}

	let { children }: Props = $props();

	const saveManager = getSaveManager();

	// https://github.com/sveltejs/kit/issues/5434
	page.subscribe(
		(p) =>
			browser &&
			p.url.pathname === "/" &&
			saveManager.save?.raw &&
			goto(resolve("/inventory")),
	);
</script>

<div class="wrapper">
	{@render children?.()}

	<nav>
		<UiButton href={resolve(`/`)} alt="Cancel">❌</UiButton>
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
