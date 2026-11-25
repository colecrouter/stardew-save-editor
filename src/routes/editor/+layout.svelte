<script lang="ts">
	import { dev } from "$app/env";
	import { beforeNavigate } from "$app/navigation";
	import { resolve } from "$app/paths";
	import {
		createPanelDrafts,
		setPanelDrafts,
	} from "$lib/editor/panel-context.ts";
	import { SaveProcessingBrowser } from "$lib/editor/save-processing-browser.ts";
	import EditorApp from "$lib/editor/ui/EditorApp.svelte";
	import EditorWorkspace from "$lib/editor/ui/EditorWorkspace.svelte";
	import { saveOriginalBackup } from "$lib/saveBackups";

	let { children: panel } = $props();

	// Each form owns its draft predicate. Ask once for the current panel even
	// when it contains several independently editable forms.
	const drafts = createPanelDrafts();
	setPanelDrafts(drafts);

	beforeNavigate(({ to, from, type, willUnload, cancel }) => {
		if (!drafts.dirty || (!willUnload && to?.route.id === from?.route.id))
			return;
		// Only Kit’s native unload hook can request the browser warning. A
		// full-page link still needs an explicit confirmation before the click.
		if (
			type === "leave" ||
			!window.confirm("Leave this panel and discard its unapplied changes?")
		)
			cancel();
	});
</script>

<svelte:head><title>Stardew Save Editor</title></svelte:head>

<EditorApp
	legacyHref={resolve("legacy")}
	backupOriginal={saveOriginalBackup}
	processingLayer={SaveProcessingBrowser}
	includeProofs={dev}
>
	{#snippet children(workspace)}
		<EditorWorkspace {...workspace}>
			{@render panel()}
		</EditorWorkspace>
	{/snippet}
</EditorApp>
