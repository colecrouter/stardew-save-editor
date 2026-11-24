<script lang="ts">
	import type { Snippet } from "svelte";

	import { resolve } from "$app/paths";

	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import type { EditorPanelPath } from "../panel-context.ts";

	let {
		section,
		onselect,
		children,
	}: {
		section: string;
		onselect?: ((section: string) => void) | undefined;
		children: Snippet;
	} = $props();
</script>

{#if onselect}
	<!-- The standalone editor selects panels locally. -->
	<StudyButton onclick={() => onselect?.(section)}>
		{@render children()}
	</StudyButton>
{:else}
	<!-- Routed shortcuts are ordinary links, so Kit handles history and guards. -->
	<a
		href={resolve(`/editor/${section}` as EditorPanelPath)}
		class="study-kit study-button study-button--neutral study-button--plain"
		data-sveltekit-reset="false"
	>
		{@render children()}
	</a>
{/if}

<style>
	a {
		text-decoration: none;
	}
</style>
